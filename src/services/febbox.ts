import AsyncStorage from '@react-native-async-storage/async-storage';

const TOKENS_STORAGE_KEY = '@febbox_tokens';
const PRIMARY_TOKEN_INDEX_KEY = '@febbox_primary_token_index';
const SERVER_STORAGE_KEY = '@febbox_server';

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
  shareKey?: string;
  allStreams?: Array<{
    url: string;
    quality: string;
    size: string;
    type: 'hls' | 'mp4' | 'other';
  }>;
  error?: string;
}

interface FebBoxFile {
  fid: number;
  file_name: string;
  file_size: string;
  file_size_bytes: number;
  ext: string;
}

interface FebBoxSearchResponse {
  code: number;
  data: {
    file_list: Array<{
      fid: number;
      file_name: string;
      file_size: string;
      file_size_bytes: number;
      ext: string;
      is_dir: number;
    }>;
  };
}

interface FebBoxMediaResponse {
  code: number;
  html: string;
}

/**
 * Get selected server from storage, default to USA7
 */
const getSelectedServer = async (): Promise<string> => {
  try {
    const serverId = await AsyncStorage.getItem(SERVER_STORAGE_KEY);
    return serverId || 'USA7'; // Default to USA7
  } catch (error) {
    console.error('Error getting server:', error);
    return 'USA7'; // Default to USA7 on error
  }
};

/**
 * Get FebBox headers for requests
 */
const getFebBoxHeaders = async (token: string, referer: string) => {
  const FAKE_G_STATE = '{"i_l":0,"i_ll":9999999999999,"i_b":"AAAABBBBCCCCDDDDEEEEFFFFGGGGHHHHIIIIJJJJKKKK","i_e":{"enable_itp_optimization":1}}';
  const OSS_GROUP = await getSelectedServer(); // Get from settings
  const cookieString = `g_state=${FAKE_G_STATE}; ui=${token}; oss_group=${OSS_GROUP}`;
  
  return {
    'Cookie': cookieString,
    'x-requested-with': 'XMLHttpRequest',
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
    'Referer': referer,
    'Accept': 'application/json, text/javascript, */*; q=0.01',
    'Accept-Language': 'en-US,en;q=0.9',
    'Origin': 'https://www.febbox.com',
  };
};

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
    const OSS_GROUP = await getSelectedServer(); // Get from settings
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

    console.log('[FebBox] Aether API success');

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

    const selectedServer = await getSelectedServer(); // Get from settings
    let shouldFallbackToAether = false;

    for (let i = 0; i < tokens.length; i++) {
      const currentIndex = (primaryIndex + i) % tokens.length;
      const token = tokens[currentIndex];

      console.log(`[FebBox] Trying token ${currentIndex + 1}/${tokens.length} with server ${selectedServer}`);

      const apiUrl = type === 'tv'
        ? `https://febapi.nuvioapp.space/api/media/tv/${tmdbId}/oss=${selectedServer}/${season}/${episode}?cookie=${encodeURIComponent(token)}`
        : `https://febapi.nuvioapp.space/api/media/movie/${tmdbId}/oss=${selectedServer}?cookie=${encodeURIComponent(token)}`;

      try {
        const response = await fetchWithTimeout(apiUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0',
            'Accept': 'application/json',
          },
        });

        // Check for service unavailable errors
        if ([500, 502, 503, 504].includes(response.status)) {
          console.log(`[FebBox] Service error (${response.status}), falling back to Aether`);
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

        // Extract share key from response
        const shareKey = data.shareKey || null;
        if (shareKey) {
          console.log('[FebBox] Share key received from API:', shareKey);
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
        }

        let best = allStreams.find(s => s.type === 'hls') || allStreams.find(s => s.type === 'mp4') || allStreams[0];

        // Convert HLS URLs to master playlist by removing quality parameter
        if (best.type === 'hls') {
          try {
            const url = new URL(best.url);
            url.searchParams.delete('quality');
            best = { ...best, url: url.toString(), quality: 'Master (Adaptive)' };
            console.log('[FebBox] Converted to master playlist');
          } catch (e) {
            // If URL parsing fails, just use as-is
            console.log('[FebBox] Could not parse URL for quality removal, using as-is');
          }
        }

        console.log(`[FebBox] Stream ready: ${best.quality} (${best.type})`);

        return {
          success: true,
          streamUrl: best.url,
          streamType: best.type,
          quality: best.quality,
          size: best.size,
          shareKey,
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

/**
 * Get FebBox stream directly from share key
 */
export const getFebBoxStreamDirect = async (
  febboxShareKey: string,
  type: 'movie' | 'tv',
  season?: number,
  episode?: number
): Promise<FebBoxStreamResult> => {
  if (type === 'tv' && (season === undefined || episode === undefined)) {
    return { success: false, error: 'Season and episode required for TV shows' };
  }

  try {
    // Get stored tokens
    const stored = await AsyncStorage.getItem(TOKENS_STORAGE_KEY);
    if (!stored) {
      return { success: false, error: 'No FebBox tokens configured' };
    }

    const tokens: string[] = JSON.parse(stored);
    if (tokens.length === 0) {
      return { success: false, error: 'No tokens available' };
    }

    const token = tokens[0];
    const shareUrl = `https://www.febbox.com/share/${febboxShareKey}`;
    const headers = await getFebBoxHeaders(token, shareUrl); // Now async

    console.log('[FebBox Direct] Starting search:', { shareKey: febboxShareKey, type, season, episode });

    // Step 1: Fetch root level
    const rootResponse = await fetch(
      `https://www.febbox.com/file/file_share_list?share_key=${febboxShareKey}&pwd=&parent_id=0&is_html=0`,
      { headers }
    );

    if (!rootResponse.ok) {
      throw new Error(`Root fetch failed: ${rootResponse.status}`);
    }

    const rootData: FebBoxSearchResponse = await rootResponse.json();
    let fileList = rootData.data.file_list;

    console.log('[FebBox Direct] Root items found:', fileList.length);

    let targetFile: FebBoxFile | null = null;

    // Step 2: Handle TV shows - find season folder
    if (type === 'tv' && season !== undefined) {
      console.log('[FebBox Direct] Searching for season', season);
      
      // Find season folder
      const seasonFolder = fileList.find(item => {
        if (item.is_dir !== 1) return false;
        // Match "season 1", "season 01", "Season 1", etc.
        const regex = new RegExp(`season\\s*0*${season}\\b`, 'i');
        return regex.test(item.file_name);
      });

      if (!seasonFolder) {
        console.log('[FebBox Direct] Season folder not found');
        return { success: false, error: `Season ${season} folder not found` };
      }

      console.log('[FebBox Direct] Found season folder:', seasonFolder.file_name);

      // Fetch files from season folder
      const seasonResponse = await fetch(
        `https://www.febbox.com/file/file_share_list?share_key=${febboxShareKey}&pwd=&parent_id=${seasonFolder.fid}&is_html=0`,
        { headers }
      );

      if (!seasonResponse.ok) {
        throw new Error(`Season folder fetch failed: ${seasonResponse.status}`);
      }

      const seasonData: FebBoxSearchResponse = await seasonResponse.json();
      const seasonFiles = seasonData.data.file_list.filter(f => f.is_dir !== 1);

      console.log('[FebBox Direct] Files in season folder:', seasonFiles.length);

      // Filter by episode
      const episodeFiles = seasonFiles.filter(f => {
        const match = f.file_name.match(/[Ss]\d+[Ee](\d+)/);
        if (!match) return false;
        const fileEpisode = parseInt(match[1], 10);
        return fileEpisode === episode;
      });

      console.log('[FebBox Direct] Matching episode files:', episodeFiles.length);

      if (episodeFiles.length === 0) {
        return { success: false, error: `Episode ${episode} not found in season ${season}` };
      }

      // Pick largest file
      targetFile = episodeFiles.reduce((largest, current) => 
        current.file_size_bytes > largest.file_size_bytes ? current : largest
      );

      console.log('[FebBox Direct] Selected file (largest):', targetFile.file_name, targetFile.file_size);

    } else {
      // Step 3: Handle movies
      console.log('[FebBox Direct] Handling movie');

      const videoFiles = fileList.filter(f => f.is_dir !== 1);
      
      if (videoFiles.length === 0) {
        return { success: false, error: 'No video files found' };
      }

      console.log('[FebBox Direct] Video files found:', videoFiles.length);

      // Prefer 2160p/4K (largest file)
      targetFile = videoFiles.reduce((largest, current) => 
        current.file_size_bytes > largest.file_size_bytes ? current : largest
      );

      console.log('[FebBox Direct] Selected file (largest):', targetFile.file_name, targetFile.file_size);
    }

    if (!targetFile) {
      return { success: false, error: 'No suitable file found' };
    }

    // Step 4: Get media URL
    console.log('[FebBox Direct] Fetching media URL for FID:', targetFile.fid);

    const mediaResponse = await fetch(
      `https://www.febbox.com/console/video_quality_list?fid=${targetFile.fid}`,
      { headers }
    );

    if (!mediaResponse.ok) {
      throw new Error(`Media URL fetch failed: ${mediaResponse.status}`);
    }

    const mediaData: FebBoxMediaResponse = await mediaResponse.json();
    const qualityHtml = mediaData.html;

    console.log('[FebBox Direct] HTML response length:', qualityHtml.length);

    // Extract HLS URL (more flexible - matches any .m3u8 URL)
    const hlsMatch = qualityHtml.match(/data-url="(https?:\/\/[^"]*(?:hls|\.m3u8)[^"]*)"/);
    
    if (hlsMatch) {
      let hlsUrl = hlsMatch[1];
      
      // Remove quality parameter to get master playlist
      hlsUrl = hlsUrl.replace(/&quality=[^&]+/, '');

      console.log('[FebBox Direct] HLS master playlist ready');

      return {
        success: true,
        streamUrl: hlsUrl,
        streamType: 'hls',
        quality: 'Master (Adaptive)',
        size: targetFile.file_size,
      };
    }

    // Fallback: Try to get ORG (original) link
    console.log('[FebBox Direct] No HLS found, trying ORG link...');
    const orgMatch = qualityHtml.match(/data-url="([^"]+)"[^>]*data-quality="ORG"/);
    
    if (orgMatch) {
      const orgUrl = orgMatch[1];
      console.log('[FebBox Direct] ORG link found');

      return {
        success: true,
        streamUrl: orgUrl,
        streamType: 'mp4',
        quality: 'Original',
        size: targetFile.file_size,
      };
    }

    console.log('[FebBox Direct] No HLS or ORG stream found in HTML');
    return { success: false, error: 'No streamable URL available' };

  } catch (error) {
    console.error('[FebBox Direct] Error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
};