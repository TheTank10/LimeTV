import axios from 'axios';
import pako from 'pako';
import { getImdbId } from './tmdb';

const OPENSUBTITLES_API_URL = 'https://rest.opensubtitles.org';
const USER_AGENT = 'LimeTV-v1.0';

// Create axios instance for OpenSubtitles
const subtitlesClient = axios.create({
  baseURL: OPENSUBTITLES_API_URL,
  headers: {
    'X-User-Agent': USER_AGENT,
    'Accept': '*/*',
    'Accept-Language': 'en-US,en;q=0.9',
  },
  timeout: 15000,
});

interface SubtitleSearchParams {
  tmdbId: number;
  language: string; // e.g., 'eng', 'spa', 'fre'
  mediaType: 'movie' | 'tv';
  season?: number;
  episode?: number;
}

interface OpenSubtitlesResponse {
  SubDownloadLink: string;
  MovieName: string;
  LanguageName: string;
  SubFormat: string;
  SubDownloadsCnt: string;
  SeriesSeason?: string;
  SeriesEpisode?: string;
}

interface SubtitleResult {
  success: boolean;
  srtContent?: string;
  error?: string;
}

/**
 * Search for subtitles on OpenSubtitles
 */
async function searchSubtitles(
  imdbId: string,
  language: string,
  season?: number,
  episode?: number
): Promise<OpenSubtitlesResponse[]> {
  const parts: string[] = [];
  
  // Clean IMDB ID (remove 'tt' prefix if present)
  const cleanImdbId = imdbId.startsWith('tt') ? imdbId.slice(2) : imdbId;
  
  // IMPORTANT: Order matters for OpenSubtitles API
  // Correct order: episode/imdbid/season/sublanguageid
  if (episode !== undefined) {
    parts.push(`episode-${episode}`);
  }
  
  parts.push(`imdbid-${cleanImdbId}`);
  
  if (season !== undefined) {
    parts.push(`season-${season}`);
  }
  
  parts.push(`sublanguageid-${language}`);
  
  const endpoint = `/search/${parts.join('/')}`;
  
  try {
    const response = await subtitlesClient.get(endpoint);
    return Array.isArray(response.data) ? response.data : [];
  } catch (error) {
    console.error('Subtitle search failed:', error instanceof Error ? error.message : 'Unknown error');
    return [];
  }
}

/**
 * Download and decompress subtitle file using axios
 */
async function downloadAndDecompressSubtitle(downloadUrl: string): Promise<string> {
  try {
    const response = await axios.get(downloadUrl, {
      responseType: 'arraybuffer',
      timeout: 30000,
    });
    
    // Decompress gzipped file
    const compressed = new Uint8Array(response.data);
    const decompressed = pako.ungzip(compressed);
    
    // Convert to text
    const textDecoder = new TextDecoder('utf-8');
    const srtContent = textDecoder.decode(decompressed);
    
    return srtContent;
  } catch (error) {
    throw new Error(`Failed to download subtitle: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Main function to get subtitles
 * Returns the SRT file content as text
 */
export async function getSubtitles(params: SubtitleSearchParams): Promise<SubtitleResult> {
  try {
    const { tmdbId, language, mediaType, season, episode } = params;
    
    const imdbId = await getImdbId(tmdbId, mediaType);
    
    if (!imdbId) {
      return {
        success: false,
        error: 'Could not find IMDB ID for this title',
      };
    }
    
    const results = await searchSubtitles(imdbId, language, season, episode);
    
    if (results.length === 0) {
      return {
        success: false,
        error: 'No subtitles found for this title',
      };
    }
    
    const bestSubtitle = results[0];
    
    if (!bestSubtitle.SubDownloadLink) {
      return {
        success: false,
        error: 'No download link available',
      };
    }

    const srtContent = await downloadAndDecompressSubtitle(bestSubtitle.SubDownloadLink);
    
    return {
      success: true,
      srtContent,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
}