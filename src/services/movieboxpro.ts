import { Platform } from 'react-native';
import CryptoJS from 'crypto-js';

import { getMovieTitle } from './tmdb';
import { getPlayableStreamUrl } from './streamProxy';

// ==============================================================================
// Constants & Reversed Secrets (MovieBoxProvider / AOneRoom Ecosystem)
// ==============================================================================

const SECRET_DEFAULT_B64 = 'NzZpUmwwN3MweFNOOWpxbUVXQXQ3OUVCSlp1bElRSXNWNjRGWnIyTw==';

/**
 * Decodes the two-stage Base64 key into a CryptoJS WordArray for HmacMD5.
 */
function decodeSecretKey(b64Key: string): CryptoJS.lib.WordArray {
  const firstPass = CryptoJS.enc.Base64.parse(b64Key).toString(CryptoJS.enc.Utf8);
  return CryptoJS.enc.Base64.parse(firstPass);
}

const SECRET_BYTES = decodeSecretKey(SECRET_DEFAULT_B64);

// Multi-Region Host Pool
const HOST_POOL = [
  'https://api.aoneroom.com',     // Global BFF cluster (primary)
  'https://api6.aoneroom.com',    // Secondary mobile cluster
  'https://api5.aoneroom.com',    // Fallback mobile cluster
  'https://api.inmoviebox.com',   // Regional MovieBox gateway
  'https://apig.inmoviebox.com',  // Regional mobile BFF
];

const DEFAULT_USER_AGENT = 'MovieBox/4.0.02 (Android 14; Pixel 6)';
const EXOPLAYER_UA = 'ExoPlayerLib/2.19.1';

// ==============================================================================
// Interfaces
// ==============================================================================

export interface MovieBoxProStreamItem {
  quality: string;
  url: string;
  format: string;
  codec?: string;
  dub?: string;
  size_bytes?: number | null;
  headers?: Record<string, string>;
}

export interface MovieBoxProSubtitleItem {
  language: string;
  url: string;
}

export interface MovieBoxProStreamResult {
  success: boolean;
  streamUrl?: string;
  streamType?: 'hls' | 'mp4' | 'other';
  quality?: string;
  title?: string;
  year?: string;
  season?: number | null;
  episode?: number | null;
  allStreams?: MovieBoxProStreamItem[];
  subtitles?: MovieBoxProSubtitleItem[];
  error?: string;
}

interface MovieBoxSubjectItem {
  subjectId?: string | number;
  title?: string;
  releaseDate?: string;
  subjectType?: number;
  [key: string]: unknown;
}

interface MovieBoxDetail {
  title?: string;
  releaseDate?: string;
  subjectType?: number;
  resourceDetectors?: Array<{
    resourceName?: string;
    resolutionList?: Array<{
      resolution?: number | string;
      resourceLink?: string;
      downloadUrl?: string;
      codecName?: string;
      fileSize?: number;
    }>;
  }>;
  subTitleList?: Array<{
    language?: string;
    lang?: string;
    url?: string;
    subUrl?: string;
  }>;
  [key: string]: unknown;
}

interface MovieBoxPlayInfo {
  signCookie?: string;
  streams?: Array<{
    url?: string;
    signCookie?: string;
    quality?: string;
    resolution?: string;
    resolutions?: string;
    format?: string;
    codecName?: string;
    size?: number;
    duration?: number;
  }>;
  streamList?: Array<{
    url?: string;
    signCookie?: string;
    quality?: string;
    resolution?: string;
    resolutions?: string;
    format?: string;
    codecName?: string;
    size?: number;
    duration?: number;
  }>;
  subTitleList?: Array<{
    language?: string;
    lang?: string;
    url?: string;
    subUrl?: string;
  }>;
  subtitles?: Array<{
    language?: string;
    lang?: string;
    url?: string;
    subUrl?: string;
  }>;
  [key: string]: unknown;
}

// ==============================================================================
// Helper Functions for Crypto, Headers & JWT
// ==============================================================================

async function fetchWithTimeout(url: string, options: RequestInit, timeoutMs = 10000): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    return response;
  } finally {
    clearTimeout(id);
  }
}

function generateDeviceId(): string {
  const chars = '0123456789abcdef';
  let result = '';
  for (let i = 0; i < 32; i++) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }
  return result;
}

function buildClientInfo(deviceId: string): string {
  return JSON.stringify({
    package_name: 'com.community.oneroom',
    version_name: '3.0.11.1230.03',
    version_code: 50020042,
    os: 'android',
    os_version: '14',
    device_id: deviceId,
    install_store: 'ps',
    gaid: '',
    brand: 'Google',
    model: 'Pixel 6',
    system_language: 'en',
    net: 'NETWORK_WIFI',
    region: 'US',
    timezone: 'America/New_York',
    sp_code: '40401',
  });
}

function jwtExp(token: string): number {
  try {
    const parts = token.split('.');
    if (parts.length < 2) return 0;
    let b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    b64 += '='.repeat((4 - (b64.length % 4)) % 4);
    const decoded = CryptoJS.enc.Base64.parse(b64).toString(CryptoJS.enc.Utf8);
    const payload = JSON.parse(decoded);
    return typeof payload.exp === 'number' ? payload.exp : 0;
  } catch {
    return 0;
  }
}

function tokenValid(token: string | null | undefined): boolean {
  if (!token) return false;
  const exp = jwtExp(token);
  return exp > Math.floor(Date.now() / 1000) + 3600;
}

function generateXClientToken(ts: number): string {
  const s = ts.toString();
  const rev = s.split('').reverse().join('');
  const hash = CryptoJS.MD5(rev).toString(CryptoJS.enc.Hex);
  return `${s},${hash}`;
}

function buildCanonicalString(
  method: string,
  accept: string,
  ctype: string,
  urlStr: string,
  bodyStr: string,
  ts: number
): string {
  const qIndex = urlStr.indexOf('?');
  const pathPart = qIndex >= 0 ? urlStr.slice(0, qIndex) : urlStr;
  const queryPart = qIndex >= 0 ? urlStr.slice(qIndex + 1) : '';

  const protoIndex = pathPart.indexOf('://');
  let pathname = pathPart;
  if (protoIndex >= 0) {
    const slashAfterHost = pathPart.indexOf('/', protoIndex + 3);
    pathname = slashAfterHost >= 0 ? pathPart.slice(slashAfterHost) : '/';
  }

  let finalPath = pathname;
  if (queryPart) {
    const pairs = queryPart
      .split('&')
      .map((part) => {
        const eqIdx = part.indexOf('=');
        return eqIdx >= 0 ? [part.slice(0, eqIdx), part.slice(eqIdx + 1)] : [part, ''];
      })
      .sort((a, b) => a[0].localeCompare(b[0]));
    finalPath += '?' + pairs.map(([k, v]) => `${k}=${v}`).join('&');
  }

  let bLen = '';
  let bHash = '';
  if (bodyStr) {
    const bodyWords = CryptoJS.enc.Utf8.parse(bodyStr);
    bLen = bodyWords.sigBytes.toString();
    bHash = CryptoJS.MD5(bodyStr.slice(0, 102400)).toString(CryptoJS.enc.Hex);
  }

  return [
    method.toUpperCase(),
    accept || '',
    ctype || '',
    bLen,
    ts.toString(),
    bHash,
    finalPath,
  ].join('\n');
}

function generateXTrSignature(
  method: string,
  accept: string,
  ctype: string,
  urlStr: string,
  bodyStr: string,
  ts: number
): string {
  const canonical = buildCanonicalString(method, accept, ctype, urlStr, bodyStr, ts);
  const mac = CryptoJS.HmacMD5(canonical, SECRET_BYTES);
  return `${ts}|2|${CryptoJS.enc.Base64.stringify(mac)}`;
}

export function parseQualityNum(qualityStr: unknown): number {
  try {
    const s = String(qualityStr || '').toLowerCase().trim();
    if (s.includes('4k')) return 2160;
    const digits = s.replace(/\D/g, '');
    return digits ? parseInt(digits, 10) : 0;
  } catch {
    return 0;
  }
}

// ==============================================================================
// MovieBoxPro Client Class
// ==============================================================================

export class MovieBoxProService {
  private deviceId: string;
  private cachedToken: string | null = null;
  private hostPool: string[];

  constructor(hostPool?: string[]) {
    this.deviceId = generateDeviceId();
    this.hostPool = hostPool || HOST_POOL;
  }

  /**
   * Fetches or refreshes an anonymous guest token.
   * Automatically tries all hosts in the pool until successful.
   */
  async fetchAnonymousToken(forceRefresh = false): Promise<string> {
    if (!forceRefresh && tokenValid(this.cachedToken)) {
      return this.cachedToken!;
    }

    const endpoint = '/wefeed-mobile-bff/tab/ranking-list?categoryType=4516404531735022304&page=1&perPage=1&tabId=0';
    const accept = 'application/json';
    const ctype = 'application/json;charset=UTF-8';

    for (const host of this.hostPool) {
      const url = `${host}${endpoint}`;
      const ts = Date.now();

      const headers: Record<string, string> = {
        'User-Agent': DEFAULT_USER_AGENT,
        'Accept': accept,
        'Content-Type': ctype,
        'X-Client-Token': generateXClientToken(ts),
        'x-tr-signature': generateXTrSignature('GET', accept, ctype, url, '', ts),
        'X-Client-Info': buildClientInfo(this.deviceId),
        'X-Client-Status': '0',
        'region': 'US',
        'lang': 'en',
        'os': 'android',
      };

      try {
        const resp = await fetchWithTimeout(url, { method: 'GET', headers }, 8000);
        const xUser = resp.headers.get('x-user') || resp.headers.get('X-User');
        if (xUser) {
          const parsed = typeof xUser === 'string' ? JSON.parse(xUser) : xUser;
          if (parsed && parsed.token) {
            this.cachedToken = parsed.token;
            console.log('[MovieBoxPro] Anonymous token acquired successfully from:', host);
            return this.cachedToken!;
          }
        }
      } catch (err) {
        console.warn(`[MovieBoxPro] Token fetch failed from ${host}:`, err instanceof Error ? err.message : String(err));
        continue;
      }
    }

    return this.cachedToken || '';
  }

  /**
   * Executes an authenticated and HMAC-signed request across available hosts.
   */
  async request<T = Record<string, unknown>>(method: 'GET' | 'POST', endpoint: string, body?: unknown): Promise<T> {
    let token = await this.fetchAnonymousToken();
    if (!token) {
      throw new Error('Failed to acquire valid MovieBox session token.');
    }

    const bodyStr = body ? JSON.stringify(body) : '';
    const accept = 'application/json';
    const ctype = 'application/json;charset=UTF-8';
    const normalizedMethod = method.toUpperCase() as 'GET' | 'POST';

    let lastError: string | null = null;

    for (const host of this.hostPool) {
      const url = `${host}${endpoint}`;
      const ts = Date.now();

      const headers: Record<string, string> = {
        'User-Agent': DEFAULT_USER_AGENT,
        'Accept': accept,
        'Content-Type': ctype,
        'Authorization': `Bearer ${token}`,
        'X-Client-Token': generateXClientToken(ts),
        'x-tr-signature': generateXTrSignature(normalizedMethod, accept, ctype, url, bodyStr, ts),
        'X-Client-Info': buildClientInfo(this.deviceId),
        'X-Client-Status': '0',
        'region': 'US',
        'lang': 'en',
        'os': 'android',
      };

      try {
        const resp = await fetchWithTimeout(
          url,
          {
            method: normalizedMethod,
            headers,
            body: bodyStr || undefined,
          },
          10000
        );

        if (resp.status === 401) {
          // Token expired; refresh and retry once
          token = await this.fetchAnonymousToken(true);
          continue;
        }

        if (!resp.ok) {
          lastError = `HTTP ${resp.status} from ${host}`;
          continue;
        }

        const data = (await resp.json()) as { code?: number; message?: string; data?: T };
        if (data && data.code === 0) {
          return (data.data || {}) as T;
        }

        lastError = `API error code ${data ? data.code : 'unknown'}: ${data ? data.message : ''}`;
        continue;
      } catch (err) {
        lastError = err instanceof Error ? err.message : String(err);
        continue;
      }
    }

    throw new Error(`All host requests failed: ${lastError}`);
  }

  /**
   * Searches for movies and series matching the query keyword.
   */
  async search(query: string, page = 1, pageSize = 10): Promise<MovieBoxSubjectItem[]> {
    try {
      const data = await this.request<{ items?: MovieBoxSubjectItem[] }>('POST', '/wefeed-mobile-bff/subject-api/search', {
        keyword: query,
        q: query,
        page,
        pageSize,
        type: 0,
      });
      return data?.items || [];
    } catch (e) {
      console.warn('[MovieBoxPro] Search error:', e);
      return [];
    }
  }

  /**
   * Fetches metadata and direct movie resources via /subject-api/get.
   */
  async getSubjectDetail(subjectId: string): Promise<MovieBoxDetail> {
    try {
      return await this.request<MovieBoxDetail>('GET', `/wefeed-mobile-bff/subject-api/get?subjectId=${subjectId}`);
    } catch (e) {
      console.warn('[MovieBoxPro] Detail error:', e);
      return {};
    }
  }

  /**
   * Fetches playback stream info via /subject-api/play-info.
   */
  async getPlayInfo(
    subjectId: string,
    season?: number,
    episode?: number,
    resourceId?: string
  ): Promise<MovieBoxPlayInfo> {
    const params: string[] = [`subjectId=${subjectId}`];
    if (season !== undefined) params.push(`se=${season}`);
    if (episode !== undefined) params.push(`ep=${episode}`);
    if (resourceId) params.push(`resourceId=${resourceId}`);

    try {
      return await this.request<MovieBoxPlayInfo>('GET', `/wefeed-mobile-bff/subject-api/play-info?${params.join('&')}`);
    } catch (e) {
      console.warn('[MovieBoxPro] PlayInfo error:', e);
      return {};
    }
  }

  /**
   * Fetches season and episode counts for series.
   */
  async getSeasonInfo(subjectId: string): Promise<Record<string, unknown>> {
    try {
      return await this.request<Record<string, unknown>>('GET', `/wefeed-mobile-bff/subject-api/season-info?subjectId=${subjectId}`);
    } catch (e) {
      console.warn('[MovieBoxPro] SeasonInfo error:', e);
      return {};
    }
  }

  /**
   * Unified stream resolver for movies and TV series.
   */
  async getStreams(
    title: string,
    episode?: number,
    season?: number
  ): Promise<MovieBoxProStreamResult> {
    let subjectId: string | null = null;
    let itemTitle = title;
    let year = '';
    let subjectType: number | null = null;

    // Check if title is already a direct numeric subjectId (15+ digits)
    if (/^\d{15,}$/.test(title.trim())) {
      subjectId = title.trim();
    } else {
      const results = await this.search(title, 1, 10);
      if (!results || results.length === 0) {
        return {
          success: false,
          error: `No results found on MovieBoxPro for "${title}"`,
        };
      }

      // Prioritize exact match over dubbed/regional entries (e.g. 'Deadpool' vs 'Deadpool [Hindi]')
      const target = title.trim().toLowerCase();
      let selected: MovieBoxSubjectItem | null = null;

      for (const item of results) {
        const t = String(item.title || '').trim().toLowerCase();
        if (t === target) {
          selected = item;
          break;
        }
      }

      if (!selected) {
        for (const item of results) {
          const t = String(item.title || '')
            .split('[')[0]
            .split('(')[0]
            .trim()
            .toLowerCase();
          if (t === target) {
            selected = item;
            break;
          }
        }
      }

      const topItem = selected || results[0];
      subjectId = String(topItem.subjectId);
      itemTitle = topItem.title || title;
      year = String(topItem.releaseDate || '').slice(0, 4);
      subjectType = topItem.subjectType ?? null;
    }

    // Fetch subject details
    const detail = await this.getSubjectDetail(subjectId);
    if (detail) {
      itemTitle = detail.title || itemTitle;
      year = String(detail.releaseDate || '').slice(0, 4) || year;
      subjectType = detail.subjectType ?? subjectType;
    }

    // Determine if TV series or Movie
    const isSeries = subjectType === 2 || episode !== undefined || season !== undefined;
    const seNum = isSeries ? (season ?? 1) : undefined;
    const epNum = isSeries ? (episode ?? 1) : undefined;

    const streams: MovieBoxProStreamItem[] = [];
    const subtitles: MovieBoxProSubtitleItem[] = [];
    const seenStreamUrls = new Set<string>();
    const seenSubUrls = new Set<string>();

    // 1. Source A: Extract from detail resourceDetectors (direct signed CDN links)
    for (const det of (detail.resourceDetectors || [])) {
      const dubName = det.resourceName || 'Original Audio';
      for (const item of (det.resolutionList || [])) {
        const resVal = item.resolution;
        const streamUrl = item.resourceLink || item.downloadUrl;
        if (streamUrl && !seenStreamUrls.has(streamUrl)) {
          seenStreamUrls.add(streamUrl);
          streams.push({
            quality: resVal ? `${resVal}p` : 'Auto',
            url: streamUrl,
            format: 'mp4',
            codec: item.codecName || 'h264',
            dub: dubName,
            size_bytes: item.fileSize,
            headers: {
              'User-Agent': EXOPLAYER_UA,
            },
          });
        }
      }
    }

    // 2. Source B: Extract from play-info API (supports movies and episode-specific feeds)
    const playInfo = await this.getPlayInfo(subjectId, seNum, epNum);
    const signCookie = playInfo.signCookie || '';
    const playStreams = playInfo.streams || playInfo.streamList || [];

    for (const s of playStreams) {
      const streamUrl = s.url || '';
      const cookieVal = s.signCookie || signCookie || '';
      const headers: Record<string, string> = {
        'User-Agent': EXOPLAYER_UA,
      };
      if (cookieVal) {
        headers['Cookie'] = cookieVal;
      }

      let resStr = s.quality || s.resolution;
      if (!resStr && s.resolutions) {
        resStr = String(s.resolutions).split(',')[0];
      }
      if (resStr && !String(resStr).endsWith('p') && /^\d+$/.test(String(resStr))) {
        resStr = `${resStr}p`;
      }

      // Check for hidden HLS (.m3u8) in urlprefix
      if (cookieVal && cookieVal.includes('urlprefix=')) {
        const match = cookieVal.match(/urlprefix=([^:;&\s]+)/);
        if (match) {
          let b64 = match[1];
          b64 += '='.repeat((4 - (b64.length % 4)) % 4);
          try {
            const prefixUrl = CryptoJS.enc.Base64.parse(b64).toString(CryptoJS.enc.Utf8);
            if (prefixUrl.startsWith('http')) {
              const hlsUrl = prefixUrl.replace(/\/+$/, '') + '/index.m3u8';
              if (!seenStreamUrls.has(hlsUrl)) {
                seenStreamUrls.add(hlsUrl);
                streams.push({
                  quality: resStr || 'Auto',
                  url: hlsUrl,
                  format: 'm3u8',
                  codec: 'h264',
                  dub: 'Original Audio',
                  headers,
                });
              }
            }
          } catch {
            // Ignore decode failures
          }
        }
      }

      // Skip decoy / dummy anti-piracy videos (e.g. 23-second ad traps)
      const dur = Number(s.duration || 0);
      const sz = Number(s.size || 0);
      const isDecoy =
        ['80da52722ee7de7a4303290af6783424', 'b164fbfb4347792950bdfbfb563d39d9'].some((h) =>
          streamUrl.includes(h)
        ) ||
        (dur >= 1 && dur < 300) ||
        sz === 824720;

      if (isDecoy) {
        continue;
      }

      if (streamUrl && !seenStreamUrls.has(streamUrl)) {
        seenStreamUrls.add(streamUrl);
        streams.push({
          quality: resStr || 'Auto',
          url: streamUrl,
          format: String(s.format || 'mp4').toLowerCase(),
          codec: s.codecName || 'hevc',
          dub: 'Original Audio',
          size_bytes: s.size,
          headers,
        });
      }
    }

    // Sort streams by quality descending (2160p/4K -> 1080p -> 720p -> 480p -> 360p)
    streams.sort((a, b) => parseQualityNum(b.quality) - parseQualityNum(a.quality));

    // On iOS, Apple's AVPlayer cannot render HEVC MP4s encoded with the 'hev1' tag.
    // We route HEVC streams through our stream proxy (dev proxy for Expo Go, on-device Swift proxy for IPA)
    // to swap 'hev1' -> 'hvc1' on the fly without re-encoding.
    if (Platform.OS === 'ios') {
      for (const s of streams) {
        const isHevc = s.codec === 'hevc' || s.url.includes('/h265/');
        if (isHevc && s.url) {
          s.url = await getPlayableStreamUrl(s.url, s.headers?.Cookie);
        }
      }
    }

    // 3. Extract subtitles from both detail and play_info
    const rawSubs = (detail.subTitleList || []).concat(
      playInfo.subTitleList || playInfo.subtitles || []
    );
    for (const sub of rawSubs) {
      const subUrl = sub.url || sub.subUrl;
      if (subUrl && !seenSubUrls.has(subUrl)) {
        seenSubUrls.add(subUrl);
        subtitles.push({
          language: sub.language || sub.lang || 'unknown',
          url: subUrl,
        });
      }
    }

    if (streams.length === 0) {
      return {
        success: false,
        error: `No playable streams found on MovieBoxPro for "${itemTitle}"`,
      };
    }

    const topStream = streams[0];

    return {
      success: true,
      streamUrl: topStream.url,
      streamType: topStream.format === 'm3u8' ? 'hls' : 'mp4',
      quality: topStream.quality,
      title: itemTitle,
      year,
      season: seNum,
      episode: epNum,
      allStreams: streams,
      subtitles,
    };
  }

  /**
   * Convenience resolver specifically for movies.
   * Can accept a movie title directly or a TMDB ID. If TMDB ID is provided and title is missing,
   * fetches the movie title from TMDB.
   */
  async getMovieStream(
    tmdbIdOrTitle: number | string,
    optionalTitle?: string
  ): Promise<MovieBoxProStreamResult> {
    try {
      let movieTitle = optionalTitle?.trim();

      if (!movieTitle || movieTitle === 'Loading...' || movieTitle === 'Unknown Title') {
        if (typeof tmdbIdOrTitle === 'string' && isNaN(Number(tmdbIdOrTitle))) {
          // Passed string title directly
          movieTitle = tmdbIdOrTitle.trim();
        } else {
          // Numeric TMDB ID — fetch movie title from TMDB API
          console.log('[MovieBoxPro] Fetching movie title from TMDB ID:', tmdbIdOrTitle);
          const fetchedTitle = await getMovieTitle(tmdbIdOrTitle);
          if (fetchedTitle) {
            movieTitle = fetchedTitle;
          }
        }
      }

      if (!movieTitle) {
        return {
          success: false,
          error: 'Could not resolve movie title for MovieBoxPro lookup',
        };
      }

      console.log('[MovieBoxPro] Searching streams for movie:', movieTitle);
      return await this.getStreams(movieTitle);
    } catch (err) {
      console.error('[MovieBoxPro] Error resolving movie stream:', err);
      return {
        success: false,
        error: err instanceof Error ? err.message : 'MovieBoxPro error',
      };
    }
  }
}

// Global singleton instance
export const movieBoxProService = new MovieBoxProService();

/**
 * Top-level helper to fetch a MovieBoxPro movie stream
 */
export const getMovieBoxProMovieStream = (
  tmdbIdOrTitle: number | string,
  title?: string
): Promise<MovieBoxProStreamResult> => {
  return movieBoxProService.getMovieStream(tmdbIdOrTitle, title);
};

/**
 * Top-level helper to fetch MovieBoxPro streams (Movie or Series)
 */
export const getMovieBoxProStreams = (
  title: string,
  episode?: number,
  season?: number
): Promise<MovieBoxProStreamResult> => {
  return movieBoxProService.getStreams(title, episode, season);
};
