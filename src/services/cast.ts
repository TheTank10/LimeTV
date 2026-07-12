import axios from 'axios';

import { getImdbId } from './tmdb';

const FIREBASE_URL = 'https://limetv-81936-default-rtdb.firebaseio.com';

export interface CastSessionData {
  streamUrl: string;
  title: string;
  timestamp: number;
  createdAt: number;
  subLang?: string;
  subLangs?: string[]; // Available subtitle language codes
  imdbId?: string;
  mediaType?: 'movie' | 'tv';
  season?: number;
  episode?: number;
}

/**
 * Generate a random 4-digit pin code
 */
export function generatePinCode(): string {
  return Math.floor(1000 + Math.random() * 9000).toString();
}

/**
 * Upload session data to Firebase under a 4-digit pin code
 */
export async function createCastSession(
  code: string,
  params: {
    videoUrl: string;
    title: string;
    currentTime: number;
    subLangs?: string[];
    tmdbId?: number;
    mediaType?: 'movie' | 'tv';
    season?: number;
    episode?: number;
    selectedSubLanguage?: string;
  }
): Promise<boolean> {
  try {
    let imdbId = '';
    if (params.tmdbId && params.mediaType) {
      const fetchedImdbId = await getImdbId(params.tmdbId, params.mediaType);
      if (fetchedImdbId) {
        imdbId = fetchedImdbId;
      }
    }

    const sessionPayload: CastSessionData = {
      streamUrl: params.videoUrl,
      title: params.title,
      timestamp: Math.floor(params.currentTime),
      createdAt: Date.now(),
      subLang: params.selectedSubLanguage || 'off',
      subLangs: params.subLangs,
      imdbId: imdbId || undefined,
      mediaType: params.mediaType,
      season: params.season,
      episode: params.episode,
    };

    const response = await axios.put(`${FIREBASE_URL}/sessions/${code}.json`, sessionPayload, {
      headers: {
        'Content-Type': 'application/json',
      },
      timeout: 10000,
    });

    return response.status === 200;
  } catch (error) {
    console.error('[Cast Service] Failed to create session:', error);
    return false;
  }
}

