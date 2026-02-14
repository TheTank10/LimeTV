import { useState, useCallback } from 'react';
import { Alert } from 'react-native';
import { getFebBoxStream, getFebBoxStreamDirect } from '../services/febbox';

interface UseStreamFetcherParams {
  itemId: number;
  mediaType: 'movie' | 'tv';
  shareKey?: string;
  onShareKeyUpdate?: (newKey: string) => void;
}

/**
 * Hook to fetch streaming URLs from FebBox
 * Handles both direct share key and TMDB-based API approaches
 */
export const useStreamFetcher = ({ 
  itemId, 
  mediaType, 
  shareKey,
  onShareKeyUpdate 
}: UseStreamFetcherParams) => {
  const [loading, setLoading] = useState(false);

  /**
   * Fetch streaming data using FebBox service
   * Uses direct share key if available, falls back to TMDB-based API
   */
  const fetchStream = useCallback(async (
    season?: number,
    episode?: number
  ): Promise<string | null> => {
    try {
      setLoading(true);

      let result;
      const isTVShow = mediaType === 'tv';

      if (shareKey) {
        // Try using direct FebBox share key first
        console.log('[useStreamFetcher] Using direct share key:', shareKey);
        result = isTVShow && season && episode
          ? await getFebBoxStreamDirect(shareKey, 'tv', season, episode)
          : await getFebBoxStreamDirect(shareKey, 'movie');

        // If direct method fails, fall back to API
        if (!result.success) {
          console.log('[useStreamFetcher] Share key failed, falling back to API');
          
          result = isTVShow && season && episode
            ? await getFebBoxStream(itemId, 'tv', season, episode)
            : await getFebBoxStream(itemId, 'movie');

          // If API succeeds and returns a new share key, update it
          if (result.success && result.shareKey && onShareKeyUpdate) {
            console.log('[useStreamFetcher] Replacing old share key with new one:', result.shareKey);
            onShareKeyUpdate(result.shareKey);
          }
        }
      } else {
        // No share key saved, use API directly
        console.log('[useStreamFetcher] Using TMDB-based API');
        result = isTVShow && season && episode
          ? await getFebBoxStream(itemId, 'tv', season, episode)
          : await getFebBoxStream(itemId, 'movie');
        
        // AUTO-SAVE share key if returned
        if (result.success && result.shareKey && onShareKeyUpdate) {
          console.log('[useStreamFetcher] Auto-saving share key from API:', result.shareKey);
          onShareKeyUpdate(result.shareKey);
        }
      }

      if (!result.success || !result.streamUrl) {
        Alert.alert('Error', result.error || 'Failed to load stream. Please try again.');
        return null;
      }

      return result.streamUrl;
    } catch (error) {
      console.error('[useStreamFetcher] Error fetching streaming data:', error);
      Alert.alert('Error', 'Failed to load streaming information. Please try again.');
      return null;
    } finally {
      setLoading(false);
    }
  }, [itemId, mediaType, shareKey, onShareKeyUpdate]);

  return {
    fetchStream,
    loading,
  };
};