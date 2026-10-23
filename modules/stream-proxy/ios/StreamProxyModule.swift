import ExpoModulesCore
import Network
import Foundation

// How many bytes to scan for the hev1 tag (moov atom is always near the start
// of a fast-start MP4)
private let kScanWindow = 512 * 1024

public class StreamProxyModule: Module {
  private var listener: NWListener?
  private var activePort: UInt16 = 8899

  public func definition() -> ModuleDefinition {
    Name("StreamProxy")

    AsyncFunction("startServerAsync") { () -> Int in
      if let listener = self.listener, listener.state == .ready {
        return Int(self.activePort)
      }

      let parameters = NWParameters.tcp
      let listener = try NWListener(using: parameters, on: NWEndpoint.Port(integerLiteral: self.activePort))

      listener.newConnectionHandler = { [weak self] connection in
        self?.handleIncomingConnection(connection)
      }

      listener.stateUpdateHandler = { state in
        switch state {
        case .ready:
          print("[StreamProxy] On-device HTTP proxy active on 127.0.0.1:\(self.activePort) (moov-only patch mode)")
        case .failed(let err):
          print("[StreamProxy] Listener failed: \(err)")
        default:
          break
        }
      }

      listener.start(queue: .global(qos: .userInitiated))
      self.listener = listener
      return Int(self.activePort)
    }

    AsyncFunction("stopServerAsync") { () -> Bool in
      self.listener?.cancel()
      self.listener = nil
      return true
    }

    Function("getServerPort") { () -> Int in
      return Int(self.activePort)
    }
  }

  private func handleIncomingConnection(_ clientConn: NWConnection) {
    clientConn.start(queue: .global(qos: .userInitiated))

    clientConn.receive(minimumIncompleteLength: 1, maximumLength: 8192) { data, _, _, _ in
      guard let data = data, let reqStr = String(data: data, encoding: .utf8) else {
        clientConn.cancel()
        return
      }

      let lines = reqStr.components(separatedBy: "\r\n")
      guard let firstLine = lines.first else {
        clientConn.cancel()
        return
      }

      let parts = firstLine.components(separatedBy: " ")
      guard parts.count >= 2 else {
        clientConn.cancel()
        return
      }

      let pathWithQuery = parts[1]
      guard let urlComponents = URLComponents(string: "http://127.0.0.1\(pathWithQuery)"),
            let targetUrlStr = urlComponents.queryItems?.first(where: { $0.name == "url" })?.value,
            let targetUrl = URL(string: targetUrlStr) else {
        let resp = "HTTP/1.1 400 Bad Request\r\nContent-Length: 0\r\n\r\n"
        clientConn.send(content: resp.data(using: .utf8), completion: .contentProcessed({ _ in clientConn.cancel() }))
        return
      }

      let cookieVal = urlComponents.queryItems?.first(where: { $0.name == "cookie" })?.value ?? ""

      // Extract Range header from AVPlayer's request
      var rangeHeader: String? = nil
      for line in lines {
        if line.lowercased().starts(with: "range:") {
          rangeHeader = line.dropFirst(6).trimmingCharacters(in: .whitespaces)
          break
        }
      }

      // ── Subsequent Range requests ────────────────────────────────────────
      // For non-initial byte ranges, issue a 302 redirect directly to the CDN
      // so the video data never flows through this on-device proxy.
      // Exception: if a cookie is required we must still proxy (can't relay
      // cookies across a cross-origin redirect).
      let isInitialRequest = rangeHeader == nil || rangeHeader!.starts(with: "bytes=0-")

      if !isInitialRequest && cookieVal.isEmpty {
        let location = targetUrl.absoluteString
        let redirectResp = "HTTP/1.1 302 Found\r\nLocation: \(location)\r\nContent-Length: 0\r\n\r\n"
        clientConn.send(content: redirectResp.data(using: .utf8), completion: .contentProcessed({ _ in
          clientConn.cancel()
        }))
        return
      }

      // ── Initial request (or cookie-gated range) ──────────────────────────
      // Proxy through URLSession, patching hev1 → hvc1 in the first 512 KB.
      var upstreamReq = URLRequest(url: targetUrl)
      upstreamReq.setValue("ExoPlayerLib/2.19.1", forHTTPHeaderField: "User-Agent")
      if !cookieVal.isEmpty {
        upstreamReq.setValue(cookieVal, forHTTPHeaderField: "Cookie")
      }
      if let range = rangeHeader {
        upstreamReq.setValue(range, forHTTPHeaderField: "Range")
      }

      let proxyTask = ProxyStreamTask(clientConn: clientConn)
      let config = URLSessionConfiguration.default
      let session = URLSession(configuration: config, delegate: proxyTask, delegateQueue: nil)
      let task = session.dataTask(with: upstreamReq)
      proxyTask.session = session
      proxyTask.task = task
      task.resume()
    }
  }
}

private class ProxyStreamTask: NSObject, URLSessionDataDelegate {
  let clientConn: NWConnection
  var session: URLSession?
  var task: URLSessionDataTask?

  private let hev1 = Data([0x68, 0x65, 0x76, 0x31])
  private let hvc1 = Data([0x68, 0x76, 0x63, 0x31])
  private var accumulator = Data()
  private var bytesScanned = 0
  private var patched = false

  init(clientConn: NWConnection) {
    self.clientConn = clientConn
    super.init()
  }

  func urlSession(_ session: URLSession, dataTask: URLSessionDataTask, didReceive response: URLResponse,
                  completionHandler: @escaping (URLSession.ResponseDisposition) -> Void) {
    guard let httpResp = response as? HTTPURLResponse else {
      completionHandler(.cancel)
      clientConn.cancel()
      return
    }

    var headerStr = "HTTP/1.1 \(httpResp.statusCode) "
    headerStr += (httpResp.statusCode == 206 ? "Partial Content" : "OK") + "\r\n"
    for (key, val) in httpResp.allHeaderFields {
      headerStr += "\(key): \(val)\r\n"
    }
    headerStr += "\r\n"

    if let headerData = headerStr.data(using: .utf8) {
      clientConn.send(content: headerData, completion: .contentProcessed({ _ in }))
    }
    completionHandler(.allow)
  }

  func urlSession(_ session: URLSession, dataTask: URLSessionDataTask, didReceive data: Data) {
    if patched {
      // Already patched — send directly
      clientConn.send(content: data, completion: .contentProcessed({ _ in }))
      return
    }

    // Still scanning — accumulate until we find hev1 or exceed scan window
    accumulator.append(data)
    bytesScanned += data.count

    if let range = accumulator.range(of: hev1) {
      accumulator.replaceSubrange(range, with: hvc1)
      print("[StreamProxy] Patched hev1 → hvc1 at byte offset \(range.lowerBound)")
      patched = true
    }

    if patched || bytesScanned >= kScanWindow {
      // Flush accumulated buffer
      let toSend = accumulator
      accumulator = Data()
      clientConn.send(content: toSend, completion: .contentProcessed({ _ in }))
    }
  }

  func urlSession(_ session: URLSession, task: URLSessionTask, didCompleteWithError error: Error?) {
    // Flush any remaining accumulated data
    if !accumulator.isEmpty {
      let remaining = accumulator
      accumulator = Data()
      clientConn.send(content: remaining, completion: .contentProcessed({ _ in }))
    }
    clientConn.send(content: nil, contentContext: .finalMessage, isComplete: true,
                    completion: .contentProcessed({ [weak self] _ in
      self?.clientConn.cancel()
      self?.session?.invalidateAndCancel()
    }))
  }
}
