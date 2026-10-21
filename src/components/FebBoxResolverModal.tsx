import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import { WebView } from 'react-native-webview';

import { febboxResolverManager, FebBoxResolveTask } from '../services/febboxResolverManager';
import { extractStreamFromHtml, FebBoxStreamResult } from '../services/febbox';

const { width } = Dimensions.get('window');

export const FebBoxResolverModal: React.FC = () => {
  const [task, setTask] = useState<FebBoxResolveTask | null>(null);
  const [statusText, setStatusText] = useState('Verifying connection...');
  const [showWebview, setShowWebview] = useState(false);
  const webViewRef = useRef<WebView>(null);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    console.log('[FebBoxResolverModal] Mounted and listening for resolve tasks');
    febboxResolverManager.setListener((newTask) => {
      console.log('[FebBoxResolverModal] Received task:', newTask?.shareKey, 'fid:', newTask?.fid);
      setTask(newTask);
      if (newTask) {
        setStatusText('Checking Cloudflare & resolving stream...');
        setShowWebview(false);

        // Safety timeout so it never hangs indefinitely
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        timeoutRef.current = setTimeout(() => {
          console.warn('[FebBoxResolverModal] Resolution timed out after 15s');
          handleCancel('Stream resolution timed out');
        }, 15000);
      }
    });

    return () => {
      febboxResolverManager.removeListener();
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const handleCancel = (reason: string = 'Cancelled by user') => {
    if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    febboxResolverManager.cancel(reason);
    setTask(null);
    setShowWebview(false);
  };

  const generateInjectedJs = (currentTask: FebBoxResolveTask) => {
    return `
      (function() {
        var shareKey = "${currentTask.shareKey}";
        var mediaType = "${currentTask.type}";
        var season = ${currentTask.season !== undefined ? currentTask.season : 'null'};
        var episode = ${currentTask.episode !== undefined ? currentTask.episode : 'null'};
        var is4K = ${currentTask.is4KEnabled ? 'true' : 'false'};
        var directFid = ${currentTask.fid !== undefined ? currentTask.fid : 'null'};

        function post(msg) {
          if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
            window.ReactNativeWebView.postMessage(JSON.stringify(msg));
          }
        }

        var isChallenge = document.title.includes('Just a moment') ||
                          document.title.includes('Cloudflare') ||
                          document.body.innerHTML.includes('cf-challenge') ||
                          document.body.innerHTML.includes('turnstile');

        if (isChallenge) {
          post({ type: 'CHALLENGE_DETECTED' });
          return;
        }

        // Set cookies in WebKit
        try {
          document.cookie = "ui=" + "${currentTask.token}" + "; path=/; domain=.febbox.com; SameSite=None; Secure";
          document.cookie = "oss_group=" + "${currentTask.server}" + "; path=/; domain=.febbox.com; SameSite=None; Secure";
        } catch(e) {}

        if (window.__isResolvingStream) return;

        async function fetchStreamData() {
          if (window.__isResolvingStream) return;
          window.__isResolvingStream = true;

          try {
            var targetFid = directFid;

            if (!targetFid) {
              post({ type: 'STATUS', text: 'Scanning directory...' });
              var rootRes = await fetch('/file/file_share_list?page=1&share_key=' + shareKey + '&pwd=&parent_id=0&is_html=0', { credentials: 'include' });
              if (!rootRes.ok) throw new Error('Share list failed: ' + rootRes.status);
              var rootData = await rootRes.json();
              var fileList = (rootData.data && rootData.data.file_list) || [];

              if (mediaType === 'tv' && season !== null) {
                var seasonFolder = fileList.find(function(item) {
                  if (String(item.is_dir) !== '1') return false;
                  var reg = new RegExp('season\\\\s*0*' + season + '\\\\b', 'i');
                  return reg.test(item.file_name);
                });

                if (!seasonFolder) {
                  for (var p = 2; p <= 3; p++) {
                    var pRes = await fetch('/file/file_share_list?page=' + p + '&share_key=' + shareKey + '&pwd=&parent_id=0&is_html=0', { credentials: 'include' });
                    if (pRes.ok) {
                      var pData = await pRes.json();
                      seasonFolder = (pData.data?.file_list || []).find(function(item) {
                        if (String(item.is_dir) !== '1') return false;
                        var reg = new RegExp('season\\\\s*0*' + season + '\\\\b', 'i');
                        return reg.test(item.file_name);
                      });
                      if (seasonFolder) break;
                    }
                  }
                }

                if (!seasonFolder) throw new Error('Season ' + season + ' folder not found');

                var epRes = await fetch('/file/file_share_list?share_key=' + shareKey + '&pwd=&parent_id=' + seasonFolder.fid + '&is_html=0', { credentials: 'include' });
                if (!epRes.ok) throw new Error('Episode list failed: ' + epRes.status);
                var epData = await epRes.json();
                var seasonFiles = (epData.data?.file_list || []).filter(function(f) { return String(f.is_dir) !== '1'; });

                var epFiles = seasonFiles.filter(function(f) {
                  var m = f.file_name.match(/[Ss]\\d+[Ee](\\d+)/);
                  return m && parseInt(m[1], 10) === episode;
                });

                if (epFiles.length === 0) throw new Error('Episode ' + episode + ' not found');

                var chosen = epFiles[0];
                for (var i = 0; i < epFiles.length; i++) {
                  var fn = epFiles[i].file_name.toLowerCase();
                  if (is4K && (fn.includes('2160p') || fn.includes('4k'))) {
                    chosen = epFiles[i];
                    break;
                  }
                  if (!is4K && (fn.includes('1080p') || fn.includes('720p'))) {
                    chosen = epFiles[i];
                  }
                }
                targetFid = chosen.fid;
              } else {
                var vidFiles = fileList.filter(function(f) { return String(f.is_dir) !== '1'; });
                if (vidFiles.length === 0) {
                  var fidMatch = document.body.innerHTML.match(/data-fid="(\\d+)"/) || document.body.innerHTML.match(/fid["']?\\s*:\\s*["']?(\\d+)/);
                  if (fidMatch) targetFid = fidMatch[1];
                } else {
                  targetFid = vidFiles[0].fid;
                }
              }
            }

            if (!targetFid) throw new Error('Target file ID could not be located');

            post({ type: 'STATUS', text: 'Querying player config for FID: ' + targetFid });

            var playerRes = await fetch('/file/player', {
              method: 'POST',
              credentials: 'include',
              headers: {
                'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
                'x-requested-with': 'XMLHttpRequest'
              },
              body: 'fid=' + targetFid + '&share_key=' + shareKey
            });

            var qualityHtml = '';
            if (playerRes.ok) {
              qualityHtml = await playerRes.text();
            }

            if (!qualityHtml || qualityHtml.includes('"please login"')) {
              var vqlRes = await fetch('/console/video_quality_list?fid=' + targetFid + '&share_key=' + shareKey, { credentials: 'include' });
              if (vqlRes.ok) {
                var vqlData = await vqlRes.json();
                if (vqlData && vqlData.html) {
                  qualityHtml = vqlData.html;
                }
              }
            }

            post({
              type: 'RESOLVED',
              targetFid: targetFid,
              qualityHtml: qualityHtml,
              shareKey: shareKey
            });
          } catch (err) {
            window.__isResolvingStream = false;
            post({ type: 'ERROR', message: err.message });
          }
        }

        fetchStreamData();
      })();
      true;
    `;
  };

  const handleMessage = (event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      console.log('[FebBoxResolverModal] Message:', data.type, data.text || '');

      if (data.type === 'CHALLENGE_DETECTED') {
        setStatusText('Solving Cloudflare challenge...');
        setShowWebview(true);
      } else if (data.type === 'STATUS') {
        if (data.text) setStatusText(data.text);
      } else if (data.type === 'RESOLVED') {
        setStatusText('Stream found!');
        if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
        if (timeoutRef.current) clearTimeout(timeoutRef.current);

        console.log('[FebBoxResolverModal] Target FID resolved:', data.targetFid, 'HTML length:', (data.qualityHtml || '').length);
        const result: FebBoxStreamResult = extractStreamFromHtml(
          data.qualityHtml,
          data.shareKey || task?.shareKey || '',
          task?.fileSize || 'Unknown'
        );

        console.log('[FebBoxResolverModal] Extracted stream result success:', result.success);
        febboxResolverManager.finish(result);
        setTask(null);
        setShowWebview(false);
      } else if (data.type === 'ERROR') {
        console.warn('[FebBoxResolverModal] Injected script error:', data.message);
      }
    } catch (e) {
      console.error('[FebBoxResolverModal] Failed to parse message:', e);
    }
  };

  const triggerInjection = () => {
    if (task && webViewRef.current) {
      console.log('[FebBoxResolverModal] Triggering script injection into WebView');
      webViewRef.current.injectJavaScript(generateInjectedJs(task));
    }
  };

  if (!task) return null;

  const cookieHeader = `ui=${task.token}; oss_group=${task.server};`;
  const injectedCookieScript = `
    document.cookie = "ui=${task.token}; path=/; domain=.febbox.com; SameSite=None; Secure";
    document.cookie = "oss_group=${task.server}; path=/; domain=.febbox.com; SameSite=None; Secure";
    true;
  `;

  const webViewElement = (
    <WebView
      ref={webViewRef}
      source={{
        uri: `https://www.febbox.com/share/${task.shareKey}`,
        headers: {
          Cookie: cookieHeader,
        },
      }}
      injectedJavaScriptBeforeContentLoaded={injectedCookieScript}
      onShouldStartLoadWithRequest={(request) => {
        if (request.url.startsWith('febbox://')) {
          console.log('[FebBoxResolverModal] Blocking deep link:', request.url);
          return false;
        }
        return true;
      }}
      onLoadStart={() => console.log('[FebBoxResolverModal] WebView load started')}
      onLoadEnd={() => {
        console.log('[FebBoxResolverModal] WebView load ended');
        triggerInjection();
        if (!pollTimerRef.current) {
          pollTimerRef.current = setTimeout(() => {
            triggerInjection();
          }, 3500);
        }
      }}
      onError={(syntheticEvent) => {
        const { nativeEvent } = syntheticEvent;
        console.warn('[FebBoxResolverModal] WebView error:', nativeEvent);
      }}
      onHttpError={(syntheticEvent) => {
        const { nativeEvent } = syntheticEvent;
        console.warn('[FebBoxResolverModal] WebView HTTP error status:', nativeEvent.statusCode);
      }}
      onMessage={handleMessage}
      javaScriptEnabled={true}
      domStorageEnabled={true}
      sharedCookiesEnabled={true}
      style={styles.webview}
    />
  );

  return (
    <View
      style={showWebview ? styles.overlay : styles.hiddenOverlay}
      pointerEvents={showWebview ? 'auto' : 'none'}
    >
      {showWebview ? (
        <View style={styles.card}>
          <Text style={styles.title}>Connecting to Stream</Text>
          <Text style={styles.subtitle}>{statusText}</Text>
          <View style={styles.visibleWebviewContainer}>
            {webViewElement}
          </View>
          <TouchableOpacity style={styles.cancelButton} onPress={() => handleCancel()}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.offscreenWebview}>
          {webViewElement}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    zIndex: 99999,
  },
  hiddenOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: 1,
    height: 1,
    zIndex: -1,
    opacity: 0.01,
  },
  offscreenWebview: {
    width: 320,
    height: 320,
  },
  card: {
    width: Math.min(width - 40, 420),
    backgroundColor: '#161616',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#262626',
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#8E8E93',
    textAlign: 'center',
    marginBottom: 16,
  },
  visibleWebviewContainer: {
    width: '100%',
    height: 280,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#000000',
    marginBottom: 16,
  },
  webview: {
    flex: 1,
  },
  cancelButton: {
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderRadius: 8,
    backgroundColor: '#262626',
  },
  cancelText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
});
