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

export type SubtitleSortStrategy = 'smart' | 'popular' | 'recent';

interface SubtitleSearchParams {
  tmdbId: number;
  language: string; // e.g., 'eng', 'spa', 'fre'
  mediaType: 'movie' | 'tv';
  season?: number;
  episode?: number;
  sortBy?: SubtitleSortStrategy; // how to sort subtitle results
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
  totalAvailable?: number; // total subtitles found
  currentIndex?: number; // which one we selected (0-based)
  releaseName?: string; // the release name of the selected subtitle
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
  
  const cleanImdbId = imdbId.startsWith('tt') ? imdbId.slice(2) : imdbId;
  
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
 * Score subtitle based on how likely it matches streaming sources
 * Higher score = better match
 */
function scoreSubtitleForStreaming(subtitle: OpenSubtitlesResponse): number {
  const name = subtitle.MovieName.toLowerCase();
  let score = 0;
  
  // Modern streaming releases (best for new content)
  if (name.includes('web-dl')) score += 100;
  if (name.includes('webrip')) score += 90;
  if (name.includes('web.')) score += 85;
  if (name.includes('amzn') || name.includes('nf') || name.includes('dsnp')) score += 80;
  
  // Physical media releases (good for older content, complete episodes)
  if (name.includes('bluray') || name.includes('brrip') || name.includes('bdrip')) score += 70;
  if (name.includes('dvdrip')) score += 60;
  
  // AVOID broadcast releases (has "Previously on..." intros and ads)
  if (name.includes('hdtv')) score -= 100;
  
  // Add download popularity bonus
  const downloads = parseInt(subtitle.SubDownloadsCnt) || 0;
  score += Math.min(downloads / 10000, 30);
  
  // Prefer HI (hearing impaired) or CC (closed captions) for completeness
  if (name.includes('.hi.') || name.includes('.cc.')) score += 5;
  
  return score;
}

/**
 * Sort subtitles based on strategy
 */
function sortSubtitles(
  results: OpenSubtitlesResponse[], 
  strategy: SubtitleSortStrategy = 'smart'
): OpenSubtitlesResponse[] {
  const sorted = [...results];
  
  switch (strategy) {
    case 'popular':
      // Sort purely by download count (most popular first)
      return sorted.sort((a, b) => {
        const downloadsA = parseInt(a.SubDownloadsCnt) || 0;
        const downloadsB = parseInt(b.SubDownloadsCnt) || 0;
        return downloadsB - downloadsA;
      });
      
    case 'recent':
      // Keep original order from API (usually most recent first)
      return sorted;
      
    case 'smart':
    default:
      // Smart scoring (avoid HDTV, prefer WEB/BluRay + popularity)
      return sorted.sort((a, b) => {
        const scoreA = scoreSubtitleForStreaming(a);
        const scoreB = scoreSubtitleForStreaming(b);
        return scoreB - scoreA;
      });
  }
}

export async function getSubtitles(
  params: SubtitleSearchParams,
  subtitleIndex: number = 0
): Promise<SubtitleResult> {
  try {
    const { tmdbId, language, mediaType, season, episode, sortBy = 'smart' } = params;
    
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
    
    // Sort results based on strategy
    const sortedResults = sortSubtitles(results, sortBy);
    
    // Use the requested index, or fall back to 0 if out of bounds
    const actualIndex = Math.min(subtitleIndex, sortedResults.length - 1);
    const selectedSubtitle = sortedResults[actualIndex];
    
    if (!selectedSubtitle.SubDownloadLink) {
      return {
        success: false,
        error: 'No download link available',
      };
    }

    const srtContent = await downloadAndDecompressSubtitle(selectedSubtitle.SubDownloadLink);
    
    return {
      success: true,
      srtContent,
      totalAvailable: sortedResults.length,
      currentIndex: actualIndex,
      releaseName: selectedSubtitle.MovieName,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
}