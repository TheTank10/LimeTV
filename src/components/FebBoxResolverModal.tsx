import React, { useState, useEffect, useRef } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import { WebView } from 'react-native-webview';

import { febboxResolverManager, FebBoxResolveTask } from '../services/febboxResolverManager';
import { extractStreamFromHtml, FebBoxStreamResult } from '../services/febbox';

const { width, height } = Dimensions.get('window');

export const FebBoxResolverModal: React.FC = () => {
  const [task, setTask] = useState<FebBoxResolveTask | null>(null);
  const [statusText, setStatusText] = useState('Verifying connection...');
  const [showWebview, setShowWebview] = useState(false);
  const webViewRef = useRef<WebView>(null);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    febboxResolverManager.setListener((newTask) => {
      setTask(newTask);
      if (newTask) {
        setStatusText('Checking Cloudflare & resolving stream...');
        setShowWebview(false);
      }
    });

    return () => {
      febboxResolverManager.removeListener();
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
      }
    };
  }, []);

  const handleCancel = () => {
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
    }
    febboxResolverManager.cancel('Cancelled by user');
    setTask(null);
  };

  const generateInjectedJs = (currentTask: FebBoxResolveTask) => {
    return `
      (function() {
        var shareKey = "${currentTask.shareKey}";
        var mediaType = "${currentTask.type}";
        var season = ${currentTask.season !== undefined ? currentTask.season : 'null'};
        var episode = ${currentTask.episode !== undefined ? currentTask.episode : 'null'};
        var is4K = ${currentTask.is4KEnabled ? 'true' : 'false'};

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

        post({ type: 'STATUS', text: 'Cloudflare passed. Extracting stream...' });

        async function fetchStreamData() {
          try {
            var rootRes = await fetch('/file/file_share_list?page=1&share_key=' + shareKey + '&pwd=&parent_id=0&is_html=0');
            if (!rootRes.ok) throw new Error('Share list failed: ' + rootRes.status);
            var rootData = await rootRes.json();
            var fileList = (rootData.data && rootData.data.file_list) || [];
            var targetFid = null;

            if (mediaType === 'tv' && season !== null) {
              var seasonFolder = fileList.find(function(item) {
                if (item.is_dir !== 1) return false;
                var reg = new RegExp('season\\\\s*0*' + season + '\\\\b', 'i');
                return reg.test(item.file_name);
              });

              if (!seasonFolder) {
                for (var p = 2; p <= 3; p++) {
                  var pRes = await fetch('/file/file_share_list?page=' + p + '&share_key=' + shareKey + '&pwd=&parent_id=0&is_html=0');
                  if (pRes.ok) {
                    var pData = await pRes.json();
                    seasonFolder = (pData.data?.file_list || []).find(function(item) {
                      if (item.is_dir !== 1) return false;
                      var reg = new RegExp('season\\\\s*0*' + season + '\\\\b', 'i');
                      return reg.test(item.file_name);
                    });
                    if (seasonFolder) break;
                  }
                }
              }

              if (!seasonFolder) throw new Error('Season ' + season + ' folder not found');

              var epRes = await fetch('/file/file_share_list?share_key=' + shareKey + '&pwd=&parent_id=' + seasonFolder.fid + '&is_html=0');
              if (!epRes.ok) throw new Error('Episode list failed: ' + epRes.status);
              var epData = await epRes.json();
              var seasonFiles = (epData.data?.file_list || []).filter(function(f) { return f.is_dir !== 1; });

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
              var vidFiles = fileList.filter(function(f) { return f.is_dir !== 1; });
              if (vidFiles.length === 0) {
                var fidMatch = document.body.innerHTML.match(/data-fid="(\\d+)"/) || document.body.innerHTML.match(/fid["']?\\s*:\\s*["']?(\\d+)/);
                if (fidMatch) targetFid = fidMatch[1];
              } else {
                targetFid = vidFiles[0].fid;
              }
            }

            if (!targetFid) throw new Error('Target file ID could not be located');

            var playerRes = await fetch('/file/player', {
              method: 'POST',
              headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
              body: 'fid=' + targetFid + '&share_key=' + shareKey
            });

            var qualityHtml = '';
            if (playerRes.ok) {
              qualityHtml = await playerRes.text();
            }

            post({
              type: 'RESOLVED',
              targetFid: targetFid,
              qualityHtml: qualityHtml,
              shareKey: shareKey
            });
          } catch (err) {
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
      console.log('[FebBoxResolverModal] Message:', data.type);

      if (data.type === 'CHALLENGE_DETECTED') {
        setStatusText('Solving Cloudflare challenge...');
        setShowWebview(true);
      } else if (data.type === 'STATUS') {
        if (data.text) setStatusText(data.text);
      } else if (data.type === 'RESOLVED') {
        setStatusText('Stream found!');
        if (pollTimerRef.current) clearInterval(pollTimerRef.current);

        const result: FebBoxStreamResult = extractStreamFromHtml(
          data.qualityHtml,
          data.shareKey || task?.shareKey || ''
        );

        febboxResolverManager.finish(result);
        setTask(null);
      } else if (data.type === 'ERROR') {
        console.warn('[FebBoxResolverModal] Script error:', data.message);
      }
    } catch (e) {
      console.error('[FebBoxResolverModal] Failed to parse message:', e);
    }
  };

  const triggerInjection = () => {
    if (task && webViewRef.current) {
      webViewRef.current.injectJavaScript(generateInjectedJs(task));
    }
  };

  if (!task) return null;

  const cookieHeader = `ui=${task.token}; oss_group=${task.server};`;
  const injectedCookieScript = `
    document.cookie = "ui=${task.token}; path=/; domain=.febbox.com";
    document.cookie = "oss_group=${task.server}; path=/; domain=.febbox.com";
    true;
  `;

  return (
    <Modal
      visible={true}
      transparent={true}
      animationType="fade"
      onRequestClose={handleCancel}
    >
      <View style={styles.overlay}>
        <View style={styles.card}>
          <Text style={styles.title}>Connecting to Stream</Text>
          <Text style={styles.subtitle}>{statusText}</Text>

          <View style={[styles.webviewContainer, !showWebview && styles.hiddenWebview]}>
            <WebView
              ref={webViewRef}
              source={{
                uri: `https://www.febbox.com/share/${task.shareKey}`,
                headers: {
                  Cookie: cookieHeader,
                },
              }}
              injectedJavaScriptBeforeContentLoaded={injectedCookieScript}
              onLoadEnd={() => {
                triggerInjection();
                if (!pollTimerRef.current) {
                  pollTimerRef.current = setInterval(triggerInjection, 2500);
                }
              }}
              onMessage={handleMessage}
              javaScriptEnabled={true}
              domStorageEnabled={true}
              sharedCookiesEnabled={true}
              style={styles.webview}
            />
          </View>

          {!showWebview && (
            <ActivityIndicator size="large" color="#C9FF00" style={styles.loader} />
          )}

          <TouchableOpacity style={styles.cancelButton} onPress={handleCancel}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
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
  webviewContainer: {
    width: '100%',
    height: 280,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#000000',
    marginBottom: 16,
  },
  hiddenWebview: {
    height: 1,
    opacity: 0,
    marginBottom: 0,
  },
  webview: {
    flex: 1,
  },
  loader: {
    marginVertical: 20,
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
