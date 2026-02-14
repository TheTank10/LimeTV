import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const SHARE_KEY_STORAGE_PREFIX = '@febbox_share_key_';

interface UseShareKeyParams {
  itemId: number;
  mediaType: 'movie' | 'tv';
  selectedSeason?: number;
}

/**
 * Hook to manage FebBox share keys for movies and TV shows
 * Handles loading, saving, and clearing share keys from AsyncStorage
 */
export const useShareKey = ({ itemId, mediaType, selectedSeason }: UseShareKeyParams) => {
  const [shareKey, setShareKey] = useState<string | undefined>();

  /**
   * Generate storage key for this content
   */
  const getStorageKey = useCallback(() => {
    if (mediaType === 'tv' && selectedSeason) {
      return `${SHARE_KEY_STORAGE_PREFIX}${mediaType}_${itemId}_s${selectedSeason}`;
    }
    return `${SHARE_KEY_STORAGE_PREFIX}${mediaType}_${itemId}`;
  }, [itemId, mediaType, selectedSeason]);

  /**
   * Load existing share key from storage
   */
  useEffect(() => {
    const loadShareKey = async () => {
      try {
        const storageKey = getStorageKey();
        const savedShareKey = await AsyncStorage.getItem(storageKey);
        if (savedShareKey) {
          console.log('[useShareKey] Loaded saved share key:', savedShareKey);
          setShareKey(savedShareKey);
        }
      } catch (error) {
        console.error('[useShareKey] Error loading share key:', error);
      }
    };

    loadShareKey();
  }, [getStorageKey]);

  /**
   * Parse share key from URL or return as-is if already a key
   */
  const parseShareKey = (input: string): string => {
    const trimmed = input.trim();
    
    // If it's a URL, extract the share key
    const urlMatch = trimmed.match(/febbox\.com\/share\/([a-zA-Z0-9]+)/);
    if (urlMatch) {
      return urlMatch[1];
    }
    
    // Otherwise assume it's already a share key
    return trimmed;
  };

  /**
   * Save share key to storage and state
   */
  const saveShareKey = useCallback(async (input: string): Promise<boolean> => {
    try {
      const parsedKey = parseShareKey(input);
      
      if (!parsedKey) {
        return false;
      }

      console.log('[useShareKey] Saving share key:', parsedKey);

      // Save to state
      setShareKey(parsedKey);

      // Save to AsyncStorage
      const storageKey = getStorageKey();
      await AsyncStorage.setItem(storageKey, parsedKey);

      return true;
    } catch (error) {
      console.error('[useShareKey] Error saving share key:', error);
      return false;
    }
  }, [getStorageKey]);

  /**
   * Update share key (used when API returns a new one)
   */
  const updateShareKey = useCallback(async (newKey: string) => {
    try {
      console.log('[useShareKey] Updating share key:', newKey);
      setShareKey(newKey);
      const storageKey = getStorageKey();
      await AsyncStorage.setItem(storageKey, newKey);
    } catch (error) {
      console.error('[useShareKey] Error updating share key:', error);
    }
  }, [getStorageKey]);

  /**
   * Clear saved share key
   */
  const clearShareKey = useCallback(async () => {
    try {
      setShareKey(undefined);
      const storageKey = getStorageKey();
      await AsyncStorage.removeItem(storageKey);
    } catch (error) {
      console.error('[useShareKey] Error clearing share key:', error);
    }
  }, [getStorageKey]);

  return {
    shareKey,
    saveShareKey,
    updateShareKey,
    clearShareKey,
  };
};