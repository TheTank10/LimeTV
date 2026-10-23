import { useState, useCallback } from 'react';
import { Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { getFebBoxStream, getFebBoxStreamDirect, FebBoxStreamResult } from '../../services/febbox';
import { getMovieBoxProMovieStream, MovieBoxProStreamResult } from '../../services/movieboxpro';
import { MOVIEBOXPRO_MOVIES_STORAGE_KEY } from '../Settings/useMovieBoxPro';

interface UseStreamFetcherParams {
  itemId: number;
  mediaType: 'movie' | 'tv';
  shareKey?: string;
  onShareKeyUpdate?: (newKey: string) => void;
  title?: string;
}

/**
 * Hook to fetch streaming URLs from FebBox and MovieBoxPro
 * Supports custom priority setting for movies and automatic fallback
 */
export const useStreamFetcher = ({ 
  itemId, 
  mediaType, 
  shareKey,
  onShareKeyUpdate,
  title,
}: UseStreamFetcherParams) => {
  const [loading, setLoading] = useState(false);

  /**
   * Fetch streaming data based on user settings and fallback rules
   */
  const fetchStream = useCallback(async (
    season?: number,
    episode?: number,
    overrideTitle?: string
  ): Promise<string | null> => {
    // Helper to fetch streaming data via FebBox
    const fetchFebBox = async (): Promise<FebBoxStreamResult> => {
      const isTVShow = mediaType === 'tv';

      if (shareKey) {
        console.log('[useStreamFetcher] Using direct FebBox share key:', shareKey);
        let result = isTVShow && season && episode
          ? await getFebBoxStreamDirect(shareKey, 'tv', season, episode)
          : await getFebBoxStreamDirect(shareKey, 'movie');

        if (!result.success) {
          console.log('[useStreamFetcher] Share key failed, falling back to FebBox API');
          result = isTVShow && season && episode
            ? await getFebBoxStream(itemId, 'tv', season, episode)
            : await getFebBoxStream(itemId, 'movie');

          if (result.success && result.shareKey && onShareKeyUpdate) {
            console.log('[useStreamFetcher] Replacing old share key with new one:', result.shareKey);
            onShareKeyUpdate(result.shareKey);
          }
        }
        return result;
      } else {
        console.log('[useStreamFetcher] Using FebBox TMDB-based API');
        const result = isTVShow && season && episode
          ? await getFebBoxStream(itemId, 'tv', season, episode)
          : await getFebBoxStream(itemId, 'movie');

        if (result.success && result.shareKey && onShareKeyUpdate) {
          console.log('[useStreamFetcher] Auto-saving share key from API:', result.shareKey);
          onShareKeyUpdate(result.shareKey);
        }
        return result;
      }
    };

    // Helper to fetch streaming data via MovieBoxPro for movies
    const fetchMovieBoxPro = async (movieTitle?: string): Promise<MovieBoxProStreamResult> => {
      const queryTitle = movieTitle || title;
      console.log('[useStreamFetcher] Querying MovieBoxPro for movie:', { itemId, queryTitle });
      return await getMovieBoxProMovieStream(itemId, queryTitle);
    };

    try {
      setLoading(true);

      const isTVShow = mediaType === 'tv';

      // For TV shows, use FebBox directly
      if (isTVShow) {
        const febboxResult = await fetchFebBox();
        if (!febboxResult.success || !febboxResult.streamUrl) {
          Alert.alert('Error', febboxResult.error || 'Failed to load stream. Please try again.');
          return null;
        }
        return febboxResult.streamUrl;
      }

      // For Movies: check the 'Use MovieBoxPro for movies' setting
      let useMovieBoxProForMovies = false;
      try {
        const storedSetting = await AsyncStorage.getItem(MOVIEBOXPRO_MOVIES_STORAGE_KEY);
        if (storedSetting !== null) {
          useMovieBoxProForMovies = JSON.parse(storedSetting);
        }
      } catch (e) {
        console.warn('[useStreamFetcher] Could not read MovieBoxPro setting:', e);
      }

      const movieTitle = overrideTitle || title;

      if (useMovieBoxProForMovies) {
        // Setting enabled: Try MovieBoxPro first, fall back to FebBox
        console.log('[useStreamFetcher] [Setting ON] Trying MovieBoxPro for movie first...');
        const mbpResult = await fetchMovieBoxPro(movieTitle);

        if (mbpResult.success && mbpResult.streamUrl) {
          console.log('[useStreamFetcher] MovieBoxPro success!');
          return mbpResult.streamUrl;
        }

        console.log('[useStreamFetcher] MovieBoxPro failed or found no stream, falling back to FebBox...', mbpResult.error);
        const febboxResult = await fetchFebBox();

        if (febboxResult.success && febboxResult.streamUrl) {
          console.log('[useStreamFetcher] FebBox fallback success!');
          return febboxResult.streamUrl;
        }

        const errorMsg = febboxResult.error || mbpResult.error || 'Failed to load stream. Please try again.';
        Alert.alert('Error', errorMsg);
        return null;
      } else {
        // Setting disabled: Try FebBox first, fall back to MovieBoxPro if FebBox fails
        console.log('[useStreamFetcher] [Setting OFF] Trying FebBox for movie first...');
        const febboxResult = await fetchFebBox();

        if (febboxResult.success && febboxResult.streamUrl) {
          console.log('[useStreamFetcher] FebBox success!');
          return febboxResult.streamUrl;
        }

        console.log('[useStreamFetcher] FebBox failed for movie, falling back to MovieBoxPro...', febboxResult.error);
        const mbpResult = await fetchMovieBoxPro(movieTitle);

        if (mbpResult.success && mbpResult.streamUrl) {
          console.log('[useStreamFetcher] MovieBoxPro fallback success!');
          return mbpResult.streamUrl;
        }

        const errorMsg = febboxResult.error || mbpResult.error || 'Failed to load stream. Please try again.';
        Alert.alert('Error', errorMsg);
        return null;
      }
    } catch (error) {
      console.error('[useStreamFetcher] Error fetching streaming data:', error);
      Alert.alert('Error', 'Failed to load streaming information. Please try again.');
      return null;
    } finally {
      setLoading(false);
    }
  }, [itemId, mediaType, shareKey, onShareKeyUpdate, title]);

  return {
    fetchStream,
    loading,
  };
};