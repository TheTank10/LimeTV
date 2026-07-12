import AsyncStorage from '@react-native-async-storage/async-storage';
import CryptoJS from 'crypto-js';

import { getImdbId } from './tmdb';

const TOKENS_STORAGE_KEY = '@febbox_tokens';
const PRIMARY_TOKEN_INDEX_KEY = '@febbox_primary_token_index';
const SERVER_STORAGE_KEY = '@febbox_server';
const IS_4K_ENABLED_KEY = '@febbox_4k_enabled';

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

interface ShowBoxSearchResult {
  id: number;
  box_type: number;
  title: string;
  year?: number;
  imdb_rating?: string;
}

interface ShowBoxSearchResponse {
  data: ShowBoxSearchResult[];
}

/**
 * Get selected server from storage, default to USA7
 */
const getSelectedServer = async (): Promise<string> => {
  try {
    const serverId = await AsyncStorage.getItem(SERVER_STORAGE_KEY);
    return serverId || 'USA7';
  } catch (error) {
    console.error('Error getting server:', error);
    return 'USA7';
  }
};

/**
 * Get FebBox headers for requests
 */
const getFebBoxHeaders = async (token: string, referer: string) => {
  const FAKE_G_STATE = '{"i_l":0,"i_ll":9999999999999,"i_b":"AAAABBBBCCCCDDDDEEEEFFFFGGGGHHHHIIIIJJJJKKKK","i_e":{"enable_itp_optimization":1}}';
  const OSS_GROUP = await getSelectedServer();
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
 * Fetch with timeout
 */
const fetchWithTimeout = async (
  url: string,
  options: RequestInit = {},
  timeout: number = 15000
): Promise<Response> => {
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
 * ShowBox Encrypted API Client (Expo-compatible with crypto-js)
 */
class ShowBoxAPI {
  private baseUrl = 'https://mbpapi.shegu.net/api/api_client/index/';
  private appKey = 'moviebox';
  private key = '123d6cedf626dy54233aa1w6';
  private iv = 'wEiphTn!';

  /**
   * Encrypt data using TripleDES (crypto-js)
   */
  private encrypt(data: string): string {
    const keyBytes = CryptoJS.enc.Utf8.parse(this.key);
    const ivBytes = CryptoJS.enc.Utf8.parse(this.iv);

    const encrypted = CryptoJS.TripleDES.encrypt(data, keyBytes, {
      iv: ivBytes,
      mode: CryptoJS.mode.CBC,
      padding: CryptoJS.pad.Pkcs7
    });

    return encrypted.toString();
  }

  /**
   * Generate MD5 hash
   */
  private md5(data: string): string {
    return CryptoJS.MD5(data).toString();
  }

  /**
   * Generate verification hash
   */
  private generateVerify(encryptedData: string): string {
    const appKeyHash = this.md5(this.appKey);
    const verifyString = appKeyHash + this.key + encryptedData;
    return this.md5(verifyString);
  }

  /**
   * Get expiry timestamp (12 hours from now)
   */
  private getExpiryTimestamp(): number {
    return Math.floor(Date.now() / 1000) + 60 * 60 * 12;
  }

  /**
   * Generate random token (32 hex chars)
   */
  private nanoid(length: number = 32): string {
    const alphabet = '0123456789abcdef';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += alphabet[Math.floor(Math.random() * alphabet.length)];
    }
    return result;
  }

  /**
   * Make encrypted API request
   */
  async request(module: string, params: Record<string, unknown> = {}): Promise<unknown> {
    const requestData = {
      childmode: '0',
      app_version: '11.5',
      lang: 'en',
      platform: 'android',
      channel: 'Website',
      appid: '27',
      expired_date: this.getExpiryTimestamp(),
      module,
      ...params,
    };

    const encryptedData = this.encrypt(JSON.stringify(requestData));

    const body = JSON.stringify({
      app_key: this.md5(this.appKey),
      verify: this.generateVerify(encryptedData),
      encrypt_data: encryptedData,
    });

    const base64Body = btoa(body);

    const formData = new URLSearchParams({
      data: base64Body,
      appid: '27',
      platform: 'android',
      version: '129',
      medium: 'Website',
    });

    const bodyString = formData.toString() + `&token=${this.nanoid()}`;

    const response = await fetch(this.baseUrl, {
      method: 'POST',
      headers: {
        'Platform': 'android',
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'okhttp/3.2.0',
      },
      body: bodyString,
    });

    return response.json();
  }

  /**
   * Search for content by IMDB ID or title
   */
  async search(keyword: string, type: string = 'all'): Promise<ShowBoxSearchResult[]> {
    try {
      const result = await this.request('Search5', {
        page: 1,
        type,
        keyword,
        pagelimit: 20,
      }) as ShowBoxSearchResponse;

      return result?.data || [];
    } catch (error) {
      console.error('[ShowBox API] Search error:', error);
      return [];
    }
  }
}

const getFebBoxShareKey = async (
  showboxMediaId: number,
  boxType: number
): Promise<string | null> => {
  try {
    // Use FebBox's direct endpoint
    const url = `https://www.febbox.com/mbp/to_share_page?box_type=${boxType}&mid=${showboxMediaId}&json=1`;

    console.log('[FebBox] Getting share key from /mbp/to_share_page');

    const response = await fetchWithTimeout(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json',
      },
    }, 10000);

    if (!response.ok) {
      console.log('[FebBox] Share key request failed:', response.status);
      return null;
    }

    const data = await response.json();

    // Expected response: {"code":1,"msg":"success","data":{"share_link":"https://www.febbox.com/share/Bp1Hw1MK"}}
    const shareLink = data?.data?.share_link || data?.data?.link;

    if (!shareLink) {
      console.log('[FebBox] No share_link in response:', data);
      return null;
    }

    // Extract share key: https://www.febbox.com/share/Bp1Hw1MK -> Bp1Hw1MK
    const shareKey = shareLink.split('/').pop();

    console.log('[FebBox] Got share key:', shareKey);
    return shareKey || null;

  } catch (error) {
    console.error('[FebBox] Share key error:', error);
    return null;
  }
};

/**
 * Extract FID from single file share HTML
 */
const extractFidFromHtml = async (
  febboxShareKey: string,
  headers: HeadersInit
): Promise<string | null> => {
  try {
    const htmlUrl = `https://www.febbox.com/share/${febboxShareKey}`;

    const response = await fetch(htmlUrl, { headers });
    if (!response.ok) {
      throw new Error(`HTML fetch failed: ${response.status}`);
    }

    const html = await response.text();

    const patterns = [
      /class="[^"]*play_video[^"]*"\s+data-id="(\d+)"/,
      /class="details"\s+data-id="(\d+)"/,
      /data-id="(\d+)"/
    ];

    for (const pattern of patterns) {
      const match = html.match(pattern);
      if (match) {
        console.log('[FebBox Direct] Extracted FID:', match[1]);
        return match[1];
      }
    }

    return null;
  } catch (error) {
    console.error('[FebBox Direct] FID extraction error:', error);
    return null;
  }
};

/**
 * Select best file based on 4K setting
 */
const selectBestFile = (files: FebBoxFile[], is4KEnabled: boolean): FebBoxFile => {
  // Filter out 3D files first
  const is3D = (file: FebBoxFile) => /\.3d\./i.test(file.file_name);
  const non3DFiles = files.filter(f => !is3D(f));

  // If all files are 3D, fall back to original files (or throw error)
  const filesToConsider = non3DFiles.length > 0 ? non3DFiles : files;

  if (is4KEnabled) {
    // 4K ON: select largest file (original logic)
    return filesToConsider.reduce((largest, current) =>
      current.file_size_bytes > largest.file_size_bytes ? current : largest
    );
  }

  // 4K OFF: prefer 1080p, avoid 4K if alternatives exist
  const has1080p = (file: FebBoxFile) => /1080p/i.test(file.file_name);
  const is4K = (file: FebBoxFile) => /2160p|4k|uhd/i.test(file.file_name);

  // Try to find 1080p files first
  const files1080p = filesToConsider.filter(has1080p);
  if (files1080p.length > 0) {
    console.log('[FebBox] 4K OFF: Selecting 1080p file');
    return files1080p.reduce((largest, current) =>
      current.file_size_bytes > largest.file_size_bytes ? current : largest
    );
  }

  // No 1080p - check if there are 4K files and alternatives
  const files4K = filesToConsider.filter(is4K);
  const nonFiles4K = filesToConsider.filter(f => !is4K(f));

  if (files4K.length > 0 && nonFiles4K.length > 0) {
    // 4K exists but so do alternatives - pick largest non-4K
    console.log('[FebBox] 4K OFF: Avoiding 4K, selecting alternative');
    return nonFiles4K.reduce((largest, current) =>
      current.file_size_bytes > largest.file_size_bytes ? current : largest
    );
  }

  // No alternatives or no 4K detected - just return largest
  console.log('[FebBox] 4K OFF: No alternatives, selecting largest available');
  return filesToConsider.reduce((largest, current) =>
    current.file_size_bytes > largest.file_size_bytes ? current : largest
  );
};

/**
 * Get stream directly from FebBox share key
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
    // Load 4K setting
    const is4KEnabledStr = await AsyncStorage.getItem(IS_4K_ENABLED_KEY);
    const is4KEnabled = is4KEnabledStr !== null ? JSON.parse(is4KEnabledStr) : true;
    console.log('[FebBox Direct] 4K Enabled:', is4KEnabled);

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
    const headers = await getFebBoxHeaders(token, shareUrl);

    console.log('[FebBox Direct] Starting:', { shareKey: febboxShareKey, type, season, episode });

    // Check if single file or folder
    const rootResponse = await fetch(
      `https://www.febbox.com/file/file_share_list?page=1&share_key=${febboxShareKey}&pwd=&parent_id=0&is_html=0`,
      { headers }
    );

    if (!rootResponse.ok) {
      throw new Error(`Root fetch failed: ${rootResponse.status}`);
    }

    const rootData: FebBoxSearchResponse = await rootResponse.json();
    const fileList = rootData.data.file_list;

    console.log('[FebBox Direct] Root items:', fileList.length);

    // Single file share
    if (fileList.length === 0) {
      const fid = await extractFidFromHtml(febboxShareKey, headers);

      if (!fid) {
        return { success: false, error: 'Could not extract FID from single file share' };
      }

      let qualityHtml = '';
      try {
        console.log('[FebBox Direct] Attempting to fetch web_player config from /file/player...');
        const playerResponse = await fetch('https://www.febbox.com/file/player', {
          method: 'POST',
          headers: {
            ...headers,
            'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
          },
          body: `fid=${fid}&share_key=${febboxShareKey}`,
        });
        if (playerResponse.ok) {
          qualityHtml = await playerResponse.text();
        }
      } catch (e) {
        console.warn('[FebBox Direct] Failed to fetch /file/player HTML, falling back to quality list:', e);
      }

      if (!qualityHtml) {
        const mediaResponse = await fetch(
          `https://www.febbox.com/console/video_quality_list?fid=${fid}&share_key=${febboxShareKey}`,
          { headers }
        );
        if (!mediaResponse.ok) {
          throw new Error(`Media URL fetch failed: ${mediaResponse.status}`);
        }
        const mediaData: FebBoxMediaResponse = await mediaResponse.json();
        qualityHtml = mediaData.html || '';
      }

      // 1. Try extracting the web_player HLS master URL (highly resilient regex - matches any HLS URL containing KEY7=web_player inside quotes)
      const webPlayerMatch = qualityHtml.match(/['"](https?:\/\/[^'"]*(?:hls|\.m3u8)[^'"]*KEY7=web_player[^'"]*)['"]/i);
      if (webPlayerMatch) {

        let hlsUrl = webPlayerMatch[1];
        hlsUrl = hlsUrl.replace(/&quality=[^&]+/, '');
        return {
          success: true,
          streamUrl: hlsUrl,
          streamType: 'hls',
          quality: 'Master (Adaptive)',
          size: 'Unknown',
          shareKey: febboxShareKey,
        };
      }

      // 2. Try ORG quality URL, but ONLY if it's an MP4 file (since iOS AVPlayer cannot decode MKV natively)
      const orgMatch = qualityHtml.match(/data-url="([^"]+)"[^>]*data-quality="ORG"/);
      if (orgMatch) {
        const orgUrl = orgMatch[1];
        const isMp4 = orgUrl.toLowerCase().includes('.mp4') || !orgUrl.toLowerCase().includes('.mkv');
        if (isMp4) {

          return {
            success: true,
            streamUrl: orgUrl,
            streamType: 'mp4',
            quality: 'Original',
            size: 'Unknown',
            shareKey: febboxShareKey,
          };
        }
      }

      // 3. Fallback: Standard HTML HLS adaptive (uses KEY7=febbox_video_quality_list_v4, might fail with 403 on some networks/IPs)
      const hlsMatch = qualityHtml.match(/data-url="(https?:\/\/[^"]*(?:hls|\.m3u8)[^"]*)"/);
      if (hlsMatch) {
        let hlsUrl = hlsMatch[1];
        hlsUrl = hlsUrl.replace(/&quality=[^&]+/, '');

        return {
          success: true,
          streamUrl: hlsUrl,
          streamType: 'hls',
          quality: 'Master (Adaptive)',
          size: 'Unknown',
          shareKey: febboxShareKey,
        };
      }

      return { success: false, error: 'No streamable URL for single file' };
    }

    // Folder share - find target file
    let targetFile: FebBoxFile | null = null;

    if (type === 'tv' && season !== undefined) {
      // Find season folder
      let seasonFolder = null;
      const maxPages = 3;

      for (let page = 1; page <= maxPages; page++) {
        const pageResponse = await fetch(
          `https://www.febbox.com/file/file_share_list?page=${page}&share_key=${febboxShareKey}&pwd=&parent_id=0&is_html=0`,
          { headers }
        );

        if (!pageResponse.ok) continue;

        const pageData: FebBoxSearchResponse = await pageResponse.json();
        const pageFileList = pageData.data.file_list;

        seasonFolder = pageFileList.find(item => {
          if (item.is_dir !== 1) return false;
          const regex = new RegExp(`season\\s*0*${season}\\b`, 'i');
          return regex.test(item.file_name);
        });

        if (seasonFolder) {
          console.log('[FebBox Direct] Found season folder:', seasonFolder.file_name);
          break;
        }
      }

      if (!seasonFolder) {
        return { success: false, error: `Season ${season} folder not found` };
      }

      // Get files from season folder
      const seasonResponse = await fetch(
        `https://www.febbox.com/file/file_share_list?share_key=${febboxShareKey}&pwd=&parent_id=${seasonFolder.fid}&is_html=0`,
        { headers }
      );

      if (!seasonResponse.ok) {
        throw new Error(`Season folder fetch failed: ${seasonResponse.status}`);
      }

      const seasonData: FebBoxSearchResponse = await seasonResponse.json();
      const seasonFiles = seasonData.data.file_list.filter(f => f.is_dir !== 1);

      const episodeFiles = seasonFiles.filter(f => {
        const match = f.file_name.match(/[Ss]\d+[Ee](\d+)/);
        if (!match) return false;
        const fileEpisode = parseInt(match[1], 10);
        return fileEpisode === episode;
      });

      if (episodeFiles.length === 0) {
        return { success: false, error: `Episode ${episode} not found` };
      }

      targetFile = selectBestFile(episodeFiles, is4KEnabled);

      console.log('[FebBox Direct] Selected episode:', targetFile.file_name);

    } else {
      // Movie
      const videoFiles = fileList.filter(f => f.is_dir !== 1);

      if (videoFiles.length === 0) {
        return { success: false, error: 'No video files found' };
      }

      targetFile = selectBestFile(videoFiles, is4KEnabled);

      console.log('[FebBox Direct] Selected movie:', targetFile.file_name);
    }

    if (!targetFile) {
      return { success: false, error: 'No suitable file found' };
    }

    // Get media URL
    let qualityHtml = '';
    try {
      console.log('[FebBox Direct] Attempting to fetch web_player config from /file/player...');
      const playerResponse = await fetch('https://www.febbox.com/file/player', {
        method: 'POST',
        headers: {
          ...headers,
          'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
        },
        body: `fid=${targetFile.fid}&share_key=${febboxShareKey}`,
      });
      if (playerResponse.ok) {
        qualityHtml = await playerResponse.text();
      }
    } catch (e) {
      console.warn('[FebBox Direct] Failed to fetch /file/player HTML, falling back to quality list:', e);
    }

    if (!qualityHtml) {
      const mediaResponse = await fetch(
        `https://www.febbox.com/console/video_quality_list?fid=${targetFile.fid}&share_key=${febboxShareKey}`,
        { headers }
      );
      if (!mediaResponse.ok) {
        throw new Error(`Media URL fetch failed: ${mediaResponse.status}`);
      }
      const mediaData: FebBoxMediaResponse = await mediaResponse.json();
      qualityHtml = mediaData.html || '';
    }

    // 1. Try extracting the web_player HLS master URL (highly resilient regex - matches any HLS URL containing KEY7=web_player inside quotes)
    const webPlayerMatch = qualityHtml.match(/['"](https?:\/\/[^'"]*(?:hls|\.m3u8)[^'"]*KEY7=web_player[^'"]*)['"]/i);
    if (webPlayerMatch) {

      let hlsUrl = webPlayerMatch[1];
      hlsUrl = hlsUrl.replace(/&quality=[^&]+/, '');
      return {
        success: true,
        streamUrl: hlsUrl,
        streamType: 'hls',
        quality: 'Master (Adaptive)',
        size: targetFile.file_size,
        shareKey: febboxShareKey,
      };
    }

    // 2. Try ORG quality URL, but ONLY if it's an MP4 file (since iOS AVPlayer cannot decode MKV natively)
    const orgMatch = qualityHtml.match(/data-url="([^"]+)"[^>]*data-quality="ORG"/);
    if (orgMatch) {
      const orgUrl = orgMatch[1];
      const isMp4 = orgUrl.toLowerCase().includes('.mp4') || !orgUrl.toLowerCase().includes('.mkv');
      if (isMp4) {

        return {
          success: true,
          streamUrl: orgUrl,
          streamType: 'mp4',
          quality: 'Original',
          size: targetFile.file_size,
          shareKey: febboxShareKey,
        };
      }
    }

    // 3. Fallback: Standard HTML HLS adaptive (uses KEY7=febbox_video_quality_list_v4, might fail with 403 on some networks/IPs)
    const hlsMatch = qualityHtml.match(/data-url="(https?:\/\/[^"]*(?:hls|\.m3u8)[^"]*)"/);
    if (hlsMatch) {
      let hlsUrl = hlsMatch[1];
      hlsUrl = hlsUrl.replace(/&quality=[^&]+/, '');

      return {
        success: true,
        streamUrl: hlsUrl,
        streamType: 'hls',
        quality: 'Master (Adaptive)',
        size: targetFile.file_size,
        shareKey: febboxShareKey,
      };
    }

    return { success: false, error: 'No streamable URL available' };

  } catch (error) {
    console.error('[FebBox Direct] Error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
};

/**
 * Method 1: ShowBox Encrypted API → FebBox Share Key → Direct FebBox
 * Flow: TMDB → IMDB → ShowBox API search → ShowBox media ID → FebBox /mbp/to_share_page → Share key → Stream
 */
const getFebBoxStreamViaShowBox = async (
  tmdbId: string | number,
  type: 'movie' | 'tv',
  season?: number,
  episode?: number
): Promise<FebBoxStreamResult> => {
  try {
    console.log('[ShowBox API] Starting for TMDB:', tmdbId);

    // 1. Convert TMDB → IMDB
    const imdbId = await getImdbId(Number(tmdbId), type);
    if (!imdbId) {
      return { success: false, error: 'Could not get IMDB ID from TMDB' };
    }

    console.log('[ShowBox API] IMDB ID:', imdbId);

    // 2. Search ShowBox encrypted API with IMDB ID
    const api = new ShowBoxAPI();
    const searchResults = await api.search(imdbId, type === 'movie' ? 'movie' : 'all');

    if (!searchResults || searchResults.length === 0) {
      console.log('[ShowBox API] No results found');
      return { success: false, error: 'No results from ShowBox API' };
    }

    const result = searchResults[0];
    const showboxMediaId = result.id;
    const boxType = result.box_type; // 1 = movie, 2 = tv

    console.log('[ShowBox API] Found:', result.title, '- ShowBox ID:', showboxMediaId, 'Box Type:', boxType);

    // 3. Get FebBox share key using /mbp/to_share_page
    const shareKey = await getFebBoxShareKey(showboxMediaId, boxType);

    if (!shareKey) {
      return { success: false, error: 'Could not get FebBox share key' };
    }

    console.log('[ShowBox API] Share key:', shareKey);

    // 4. Use direct FebBox API with share key
    const streamResult = await getFebBoxStreamDirect(shareKey, type, season, episode);

    if (streamResult.success) {
      console.log('[ShowBox API] SUCCESS via ShowBox encrypted API!');
    }

    return streamResult;

  } catch (error) {
    console.error('[ShowBox API] Error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'ShowBox API error',
    };
  }
};

/**
 * Method 2: Nuvio API fallback
 */
const getFebBoxStreamViaNuvio = async (
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

    const primaryIndexStr = await AsyncStorage.getItem(PRIMARY_TOKEN_INDEX_KEY);
    let primaryIndex = primaryIndexStr ? parseInt(primaryIndexStr, 10) : 0;

    if (primaryIndex >= tokens.length || primaryIndex < 0) {
      primaryIndex = 0;
    }

    const selectedServer = await getSelectedServer();

    for (let i = 0; i < tokens.length; i++) {
      const currentIndex = (primaryIndex + i) % tokens.length;
      const token = tokens[currentIndex];

      console.log(`[Nuvio] Trying token ${currentIndex + 1}/${tokens.length}`);

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

        if ([500, 502, 503, 504].includes(response.status)) {
          console.log('[Nuvio] Service error, skipping to next method');
          break;
        }

        if (!response.ok) {
          console.log(`[Nuvio] Token ${currentIndex + 1} failed: ${response.status}`);
          continue;
        }

        const data = await response.json();

        if (!data.success || !data.versions?.length) {
          console.log(`[Nuvio] Token ${currentIndex + 1}: No streams`);
          continue;
        }

        const allStreams: Array<{
          url: string;
          quality: string;
          size: string;
          type: 'hls' | 'mp4' | 'other';
        }> = [];

        for (const version of data.versions) {
          for (const link of version.links || []) {
            if (!link.url) continue;

            const url = link.url.toLowerCase();
            const streamType = url.includes('.m3u8') ? 'hls' : url.includes('.mp4') ? 'mp4' : 'other';

            allStreams.push({
              url: link.url,
              quality: link.quality || 'Unknown',
              size: link.size || 'Unknown',
              type: streamType,
            });
          }
        }

        if (!allStreams.length) continue;

        if (currentIndex !== primaryIndex) {
          await AsyncStorage.setItem(PRIMARY_TOKEN_INDEX_KEY, currentIndex.toString());
        }

        let best = allStreams.find(s => s.type === 'hls') || allStreams[0];

        if (best.type === 'hls') {
          try {
            const url = new URL(best.url);
            url.searchParams.delete('quality');
            best = { ...best, url: url.toString(), quality: 'Master (Adaptive)' };
          } catch {
            // Use as-is
          }
        }

        console.log('[Nuvio] SUCCESS!');

        return {
          success: true,
          streamUrl: best.url,
          streamType: best.type,
          quality: best.quality,
          size: best.size,
          shareKey: data.shareKey,
          allStreams,
        };

      } catch (error) {
        console.log(`[Nuvio] Token ${currentIndex + 1} error:`, error instanceof Error ? error.message : 'Unknown');
        continue;
      }
    }

    return { success: false, error: 'All Nuvio tokens failed' };

  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Nuvio error',
    };
  }
};

/**
 * Method 3: Aether API fallback
 */
const getFebBoxStreamViaAether = async (
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

    console.log('[Aether] Trying last resort fallback...');

    const response = await fetchWithTimeout(apiUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0',
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      return { success: false, error: `Aether failed: ${response.status}` };
    }

    const data = await response.json();

    if (!data.hls) {
      return { success: false, error: 'No HLS in Aether response' };
    }

    console.log('[Aether] SUCCESS!');

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
      error: error instanceof Error ? error.message : 'Aether error',
    };
  }
};

/**
 * MAIN FUNCTION: Get FebBox stream with 3-tier fallback system
 * 1. ShowBox encrypted API → FebBox /mbp/to_share_page → Direct FebBox
 * 2. Nuvio API
 * 3. Aether API
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

  console.log('FebBox Stream Request:', { tmdbId, type, season, episode });

  console.log('\n[Method 1] Trying ShowBox encrypted API...');
  const showboxResult = await getFebBoxStreamViaShowBox(tmdbId, type, season, episode);

  if (showboxResult.success) {
    console.log('ShowBox API success!\n');
    return showboxResult;
  }

  console.log('ShowBox API failed:', showboxResult.error);

  console.log('\n[Method 2] Trying Nuvio API...');
  const nuvioResult = await getFebBoxStreamViaNuvio(tmdbId, type, season, episode);

  if (nuvioResult.success) {
    console.log('Nuvio API success!\n');
    return nuvioResult;
  }

  console.log('Nuvio API failed:', nuvioResult.error);

  console.log('\n[Method 3] Trying Aether API (last resort)...');
  const aetherResult = await getFebBoxStreamViaAether(tmdbId, type, season, episode);

  if (aetherResult.success) {
    console.log('Aether API success!\n');
    return aetherResult;
  }

  console.log('All methods failed\n');
  return { success: false, error: 'All streaming methods failed' };
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
    const OSS_GROUP = await getSelectedServer();
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