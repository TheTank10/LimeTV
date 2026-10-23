/* eslint-disable no-undef */
/**
 * LimeTV Development Stream Proxy for Expo Go
 */

const http = require('http');
const https = require('https');
const { URL } = require('url');

const DEFAULT_PORT = 8080;
const HEV1 = Buffer.from('hev1', 'ascii');
const HVC1 = Buffer.from('hvc1', 'ascii');

const SCAN_WINDOW = 512 * 1024; // 512 KB

function buildUpstreamHeaders(req, cookie) {
  const headers = { 'User-Agent': 'ExoPlayerLib/2.19.1' };
  if (req.headers['range']) headers['Range'] = req.headers['range'];
  if (cookie) headers['Cookie'] = cookie;
  return headers;
}

function startProxy(port = DEFAULT_PORT) {
  if (global.__limeDevProxyStarted) {
    return global.__limeDevProxyServer;
  }
  global.__limeDevProxyStarted = true;

  const server = http.createServer((req, res) => {
    try {
      const reqUrl = new URL(req.url, `http://localhost:${port}`);
      const targetUrl = reqUrl.searchParams.get('url');
      const cookie = reqUrl.searchParams.get('cookie') || '';

      if (!targetUrl) {
        res.writeHead(400, { 'Content-Type': 'text/plain' });
        return res.end('Missing "url" query parameter');
      }

      const rangeHeader = req.headers['range'];
      const isInitialRequest = !rangeHeader || rangeHeader.startsWith('bytes=0-');

      // ── Subsequent range requests ─────────────────────────────────────────
      // Redirect directly to the CDN so video data never routes through this machine.
      if (!isInitialRequest) {
        // Build redirect URL with the cookie baked into the query string
        // (AVPlayer won't forward custom headers, but the upstream CDN uses signed
        //  URLs / cookies already embedded in the URL or cookie header)
        const upstreamUrl = new URL(targetUrl);
        const redirectHeaders = {
          'Location': upstreamUrl.toString(),
          'Access-Control-Allow-Origin': '*',
        };

        // If cookie is needed, we can't relay it via redirect, so still proxy —
        // but skip the patch since this is a range request beyond the moov atom.
        if (cookie) {
          // Must still proxy (cookie can't survive a redirect to cross-origin CDN)
          const client = targetUrl.startsWith('https') ? https : http;
          const upstreamReq = client.get(targetUrl, {
            headers: buildUpstreamHeaders(req, cookie),
          }, (upstreamRes) => {
            res.writeHead(upstreamRes.statusCode, upstreamRes.headers);
            upstreamRes.pipe(res, { end: true });
          });
          upstreamReq.on('error', (err) => {
            if (!res.headersSent) res.writeHead(502);
            res.end(err.message);
          });
          return;
        }

        res.writeHead(302, redirectHeaders);
        return res.end();
      }

      // ── Initial request ───────────────────────────────────────────────────
      // Proxy and patch the hev1 → hvc1 FourCC in the moov/stsd atom.
      const client = targetUrl.startsWith('https') ? https : http;
      const upstreamHeaders = buildUpstreamHeaders(req, cookie);

      const upstreamReq = client.get(targetUrl, { headers: upstreamHeaders }, (upstreamRes) => {
        res.writeHead(upstreamRes.statusCode, upstreamRes.headers);

        let bytesScanned = 0;
        let patched = false;
        let patchBuffer = Buffer.alloc(0);

        upstreamRes.on('data', (chunk) => {
          if (!patched && bytesScanned < SCAN_WINDOW) {
            // Accumulate enough data to safely search across chunk boundaries
            patchBuffer = Buffer.concat([patchBuffer, chunk]);
            bytesScanned += chunk.length;

            const idx = patchBuffer.indexOf(HEV1);
            if (idx !== -1) {
              HVC1.copy(patchBuffer, idx);
              patched = true;
              console.log(`[DevProxy] Patched hev1 → hvc1 at byte offset ${idx}`);
            }

            // Flush once we've scanned enough (or found + patched)
            if (patched || bytesScanned >= SCAN_WINDOW) {
              res.write(patchBuffer);
              patchBuffer = Buffer.alloc(0);
            }
          } else {
            // Already patched (or past scan window) — flush accumulated buffer first
            if (patchBuffer.length > 0) {
              res.write(patchBuffer);
              patchBuffer = Buffer.alloc(0);
            }
            res.write(chunk);
          }
        });

        upstreamRes.on('end', () => {
          // Flush any remaining buffered data
          if (patchBuffer.length > 0) {
            res.write(patchBuffer);
          }
          res.end();
        });

        upstreamRes.on('error', (err) => {
          console.error('[DevProxy] Upstream stream error:', err.message);
          res.end();
        });
      });

      upstreamReq.on('error', (err) => {
        console.error('[DevProxy] Upstream request error:', err.message);
        if (!res.headersSent) res.writeHead(502, { 'Content-Type': 'text/plain' });
        res.end(`Proxy error: ${err.message}`);
      });

    } catch (err) {
      console.error('[DevProxy] Handler error:', err);
      if (!res.headersSent) res.writeHead(500);
      res.end();
    }
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.log(`[DevProxy] Port ${port} already in use — proxy already running.`);
    } else {
      console.error('[DevProxy] Server error:', err.message);
    }
  });

  server.listen(port, '0.0.0.0', () => {
    console.log(` [LimeTV Dev Proxy] Running at http://0.0.0.0:${port} (moov-only patch mode)`);
  });

  global.__limeDevProxyServer = server;
  return server;
}

if (require.main === module) {
  startProxy();
}

module.exports = { startProxy };
