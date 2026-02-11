import AsyncStorage from '@react-native-async-storage/async-storage';

const TOKENS_STORAGE_KEY = '@febbox_tokens';
const PRIMARY_TOKEN_INDEX_KEY = '@febbox_primary_token_index';

export interface FebBoxTrafficData {
  traffic_usage: string;
  traffic_usage_mb: number;
  traffic_limit: string;
  traffic_limit_mb: number;
  is_vip: number;
  reset_at: string;
}

export interface TokenValidationResult {
  isValid: boolean;
  data?: FebBoxTrafficData;
  error?: string;
}

export interface FebBoxStreamResult {
  success: boolean;
  streamUrl?: string;
  streamType?: 'hls' | 'mp4' | 'other';
  quality?: string;
  size?: string;
  allStreams?: Array<{
    url: string;
    quality: string;
    size: string;
    type: 'hls' | 'mp4' | 'other';
  }>;
  error?: string;
}

/**
 * Validates a FebBox UI token
 */
export const validateFebBoxToken = async (
  uiToken: string
): Promise<TokenValidationResult> => {
  if (!uiToken || uiToken.trim() === '') {
    return { isValid: false, error: 'UI token is required' };
  }

  try {
    const url = 'https://www.febbox.com/console/user_traffic_query';
    const FAKE_G_STATE = '{"i_l":0,"i_ll":9999999999999,"i_b":"AAAABBBBCCCCDDDDEEEEFFFFGGGGHHHHIIIIJJJJKKKK","i_e":{"enable_itp_optimization":1}}';
    const OSS_GROUP = 'USA7';
    const cookieString = `g_state=${FAKE_G_STATE}; ui=${uiToken}; oss_group=${OSS_GROUP}`;
    
    const headers = {
      'Accept': 'application/json, text/javascript, */*; q=0.01',
      'Accept-Language': 'en-US,en;q=0.9',
      'Cookie': cookieString,
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Referer': 'https://www.febbox.com/',
      'Origin': 'https://www.febbox.com',
      'x-requested-with': 'XMLHttpRequest',
    };
    
    const response = await fetch(url, {
      method: 'GET',
      headers: headers,
      credentials: 'include',
    });

    const text = await response.text();
    const contentType = response.headers.get('content-type') || '';

    if (contentType.includes('text/html') || text.trim().startsWith('<')) {
      return { isValid: false, error: 'Authentication failed - invalid UI token' };
    }

    const result = JSON.parse(text);

    if (result.code === 1 && result.data) {
      return { isValid: true, data: result.data };
    }

    return { isValid: false, error: result.msg || 'Invalid response' };
  } catch (error) {
    return { 
      isValid: false, 
      error: 'Request failed: ' + (error instanceof Error ? error.message : 'Unknown error') 
    };
  }
};

/**
 * Check if token has traffic remaining
 */
export const hasTrafficRemaining = (data: FebBoxTrafficData): boolean => {
  return data.traffic_usage_mb < data.traffic_limit_mb;
};

/**
 * Fetch with timeout helper for React Native
 */
const fetchWithTimeout = async (url: string, options: RequestInit = {}, timeout: number = 15000): Promise<Response> => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
};

/**
 * Fallback to Aether API when febapi is down
 */
const getFebBoxStreamFromAether = async (
  tmdbId: string | number,
  type: 'movie' | 'tv',
  season?: number,
  episode?: number
): Promise<FebBoxStreamResult> => {
  try {
    const stored = await AsyncStorage.getItem(TOKENS_STORAGE_KEY);
    if (!stored) {
      return { success: false, error: 'No tokens configured' };
    }

    const tokens: string[] = JSON.parse(stored);
    if (tokens.length === 0) {
      return { success: false, error: 'No tokens available' };
    }

    const token = tokens[0];

    const apiUrl = type === 'tv'
      ? `https://fembox.aether.mom/hls/tv/${tmdbId}/${season}/${episode}?ui=${encodeURIComponent(token)}`
      : `https://fembox.aether.mom/hls/movie/${tmdbId}?ui=${encodeURIComponent(token)}`;

    console.log('[FebBox] Using fallback Aether API');

    const response = await fetchWithTimeout(apiUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0',
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      return { success: false, error: `Aether API failed: ${response.status}` };
    }

    const data = await response.json();

    if (!data.hls) {
      return { success: false, error: 'No HLS stream in Aether response' };
    }

    console.log('[FebBox] ✓ Aether API success');

    return {
      success: true,
      streamUrl: data.hls,
      streamType: 'hls',
      quality: 'Auto',
      size: 'Unknown',
      allStreams: [{
        url: data.hls,
        quality: 'Auto',
        size: 'Unknown',
        type: 'hls',
      }],
    };

  } catch (error) {
    return {
      success: false,
      error: 'Aether API error: ' + (error instanceof Error ? error.message : 'Unknown'),
    };
  }
};

/**
 * Get streaming URL with automatic token cycling and fallback
 */
export const getFebBoxStream = async (
  tmdbId: string | number,
  type: 'movie' | 'tv',
  season?: number,
  episode?: number
): Promise<FebBoxStreamResult> => {
  if (type === 'tv' && (season === undefined || episode === undefined)) {
    return { success: false, error: 'Season and episode required for TV' };
  }

  try {
    const stored = await AsyncStorage.getItem(TOKENS_STORAGE_KEY);
    if (!stored) {
      return { success: false, error: 'No tokens configured' };
    }

    const tokens: string[] = JSON.parse(stored);
    if (tokens.length === 0) {
      return { success: false, error: 'No tokens available' };
    }

    const primaryIndexStr = await AsyncStorage.getItem(PRIMARY_TOKEN_INDEX_KEY);
    let primaryIndex = primaryIndexStr ? parseInt(primaryIndexStr, 10) : 0;

    if (primaryIndex >= tokens.length || primaryIndex < 0) {
      primaryIndex = 0;
      await AsyncStorage.setItem(PRIMARY_TOKEN_INDEX_KEY, '0');
    }

    let shouldFallbackToAether = false;

    for (let i = 0; i < tokens.length; i++) {
      const currentIndex = (primaryIndex + i) % tokens.length;
      const token = tokens[currentIndex];

      console.log(`[FebBox] Trying token ${currentIndex + 1}/${tokens.length}`);

      const apiUrl = type === 'tv'
        ? `https://febapi.nuvioapp.space/api/media/tv/${tmdbId}/oss=USA7/${season}/${episode}?cookie=${encodeURIComponent(token)}`
        : `https://febapi.nuvioapp.space/api/media/movie/${tmdbId}/oss=USA7?cookie=${encodeURIComponent(token)}`;

      try {
        const response = await fetchWithTimeout(apiUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0',
            'Accept': 'application/json',
          },
        });

        // Check for service unavailable errors
        if ([502, 503, 504].includes(response.status)) {
          console.log(`[FebBox] FebAPI service down (${response.status}), will fallback to Aether`);
          shouldFallbackToAether = true;
          break;
        }

        if (!response.ok) {
          console.log(`[FebBox] Token ${currentIndex + 1} failed: HTTP ${response.status}`);
          continue;
        }

        const data = await response.json();

        if (!data.success || !data.versions?.length) {
          console.log(`[FebBox] Token ${currentIndex + 1} failed: ${data.error || 'No streams'}`);
          continue;
        }

        const allStreams: Array<{ url: string; quality: string; size: string; type: 'hls' | 'mp4' | 'other' }> = [];

        for (const version of data.versions) {
          for (const link of version.links || []) {
            if (!link.url) continue;
            
            const url = link.url.toLowerCase();
            const streamType = url.includes('.m3u8') ? 'hls' : url.includes('.mp4') ? 'mp4' : 'other';
            
            allStreams.push({
              url: link.url,
              quality: link.quality || link.name || 'Unknown',
              size: link.size || version.size || 'Unknown',
              type: streamType,
            });
          }
        }

        if (!allStreams.length) {
          console.log(`[FebBox] Token ${currentIndex + 1} failed: No valid streams`);
          continue;
        }

        if (currentIndex !== primaryIndex) {
          await AsyncStorage.setItem(PRIMARY_TOKEN_INDEX_KEY, currentIndex.toString());
          console.log(`[FebBox] Switched primary token to ${currentIndex + 1}`);
        } else {
          console.log(`[FebBox] Using primary token ${currentIndex + 1}`);
        }

        let best = allStreams.find(s => s.type === 'hls') || allStreams.find(s => s.type === 'mp4') || allStreams[0];

        if (best.type === 'hls') {
          const masterUrl = best.url.match(/\/(\d+)\.m3u8/)?.[1];
          if (masterUrl) {
            const url = new URL(best.url);
            url.pathname = `/${masterUrl}/index.m3u8`;
            best = { ...best, url: url.toString(), quality: 'Master' };
          }
        }

        return {
          success: true,
          streamUrl: best.url,
          streamType: best.type,
          quality: best.quality,
          size: best.size,
          allStreams,
        };

      } catch (error) {
        console.log(`[FebBox] Token ${currentIndex + 1} error:`, error instanceof Error ? error.message : 'Unknown');
        
        // Network/timeout errors suggest service is down
        if (error instanceof Error && error.name === 'AbortError') {
          console.log('[FebBox] Request timeout, trying Aether fallback');
          shouldFallbackToAether = true;
          break;
        }
        
        continue;
      }
    }

    // If service is down or all tokens failed, try Aether fallback
    if (shouldFallbackToAether) {
      console.log('[FebBox] Falling back to Aether API...');
      return getFebBoxStreamFromAether(tmdbId, type, season, episode);
    }

    return { success: false, error: 'All tokens failed or exhausted' };

  } catch (error) {
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
};