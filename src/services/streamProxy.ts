import { Platform } from 'react-native';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { requireOptionalNativeModule } from 'expo';

interface StreamProxyNative {
  startServerAsync(): Promise<number>;
  stopServerAsync(): Promise<boolean>;
  getServerPort(): number;
}

// Attempt to load the native module (only present in standalone IPA / Dev Client builds)
const NativeStreamProxy = requireOptionalNativeModule<StreamProxyNative>('StreamProxy');

// Port used by the Node dev-proxy for Expo Go
const DEV_PROXY_PORT = 8080;

/**
 * Returns the local IP address of the development machine running Expo CLI.
 */
function getDevMachineHost(): string {
  const hostUri = Constants.expoConfig?.hostUri;
  if (hostUri) {
    return hostUri.split(':')[0];
  }
  return 'localhost';
}

/**
 * Resolves a playable stream URL for iOS devices.
 * 
 * - In an IPA / Dev Client: starts and routes through the on-device Swift proxy (127.0.0.1)
 * - In Expo Go: routes through the local dev-proxy (dev machine Wi-Fi IP : 8080)
 * - On Android: returns the original stream URL unchanged (ExoPlayer natively handles hev1)
 *
 * @param streamUrl The direct upstream video URL (e.g. MovieBoxPro MP4)
 * @param cookie Optional auth or sign cookie to forward
 */
export async function getPlayableStreamUrl(
  streamUrl: string,
  cookie?: string
): Promise<string> {
  // Android natively supports hev1 via ExoPlayer without requiring FourCC patching
  if (Platform.OS !== 'ios' || !streamUrl) {
    return streamUrl;
  }

  const encodedUrl = encodeURIComponent(streamUrl);
  const encodedCookie = cookie ? encodeURIComponent(cookie) : '';
  const query = `url=${encodedUrl}${encodedCookie ? `&cookie=${encodedCookie}` : ''}`;

  const isExpoGo =
    Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

  // 1. Production / IPA build: Run native on-device proxy
  if (NativeStreamProxy && !isExpoGo) {
    try {
      const port = await NativeStreamProxy.startServerAsync();
      console.log(`[StreamProxy] Routing through on-device proxy on port ${port}`);
      return `http://127.0.0.1:${port}/proxy?${query}`;
    } catch (err) {
      console.warn('[StreamProxy] Failed to start native on-device proxy, falling back to original URL:', err);
      return streamUrl;
    }
  }

  // 2. Development (Expo Go): Route to the dev machine's Node proxy
  const devHost = getDevMachineHost();
  console.log(`[StreamProxy] Routing through Expo Go dev proxy: http://${devHost}:${DEV_PROXY_PORT}`);
  return `http://${devHost}:${DEV_PROXY_PORT}/proxy?${query}`;
}
