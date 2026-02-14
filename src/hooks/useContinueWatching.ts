import { useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const CONTINUE_WATCHING_KEY = '@continue_watching';
const MAX_ITEMS = 10;

export interface ContinueWatchingItem {
  tmdbId: number;
  mediaType: 'movie' | 'tv';
  timestamp: number;           // current playback position in seconds
  duration: number;            // total length in seconds
  season?: number;             // for TV shows
  episode?: number;            // for TV shows
  lastWatched: number;         // Date.now() timestamp
}

interface SaveProgressParams {
  tmdbId: number;
  mediaType: 'movie' | 'tv';
  timestamp: number;
  duration: number;
  season?: number;
  episode?: number;
}

export const useContinueWatching = () => {
  /**
   * Load all continue watching items from storage
   */
  const loadItems = useCallback(async (): Promise<ContinueWatchingItem[]> => {
    try {
      const data = await AsyncStorage.getItem(CONTINUE_WATCHING_KEY);
      if (!data) return [];
      return JSON.parse(data);
    } catch (error) {
      console.error('Failed to load continue watching items:', error);
      return [];
    }
  }, []);

  /**
   * Save all items back to storage
   */
  const saveItems = useCallback(async (items: ContinueWatchingItem[]): Promise<void> => {
    try {
      await AsyncStorage.setItem(CONTINUE_WATCHING_KEY, JSON.stringify(items));
    } catch (error) {
      console.error('Failed to save continue watching items:', error);
    }
  }, []);

  /**
   * Remove a specific item by tmdbId
   */
  const removeProgress = useCallback(async (tmdbId: number): Promise<void> => {
    const items = await loadItems();
    const filtered = items.filter(item => item.tmdbId !== tmdbId);
    await saveItems(filtered);
  }, [loadItems, saveItems]);

  /**
   * Save or update progress for a show/movie
   * If item exists, updates it. If new, adds to front. Maintains max 10 items.
   * Automatically removes item if progress > 95% (user finished watching).
   */
  const saveProgress = useCallback(async (params: SaveProgressParams): Promise<void> => {
    const { tmdbId, mediaType, timestamp, duration, season, episode } = params;

    const progress = (timestamp / duration) * 100;
    
    // Don't save if progress is too early (<5%)
    if (progress < 5 || duration === 0) {
      return;
    }

    // Remove from continue watching if user finished watching (>95%)
    if (progress > 95) {
      console.log(`[ContinueWatching] Removing ${tmdbId} - user finished watching (${progress.toFixed(1)}%)`);
      await removeProgress(tmdbId);
      return;
    }

    const items = await loadItems();
    
    // Find existing item by tmdbId
    const existingIndex = items.findIndex(item => item.tmdbId === tmdbId);
    
    const newItem: ContinueWatchingItem = {
      tmdbId,
      mediaType,
      timestamp,
      duration,
      season,
      episode,
      lastWatched: Date.now(),
    };

    if (existingIndex !== -1) {
      // Update existing item and move to front
      items.splice(existingIndex, 1);
    }
    
    // Add to front
    items.unshift(newItem);
    
    // Keep only the 10 most recent
    const trimmedItems = items.slice(0, MAX_ITEMS);
    
    await saveItems(trimmedItems);
  }, [loadItems, saveItems, removeProgress]);

  /**
   * Get progress for a specific tmdbId
   */
  const getProgress = useCallback(async (tmdbId: number): Promise<ContinueWatchingItem | null> => {
    const items = await loadItems();
    return items.find(item => item.tmdbId === tmdbId) || null;
  }, [loadItems]);

  /**
   * Get all continue watching items (sorted by lastWatched, most recent first)
   */
  const getAllProgress = useCallback(async (): Promise<ContinueWatchingItem[]> => {
    return await loadItems();
  }, [loadItems]);

  /**
   * Clear all continue watching data
   */
  const clearAll = useCallback(async (): Promise<void> => {
    try {
      await AsyncStorage.removeItem(CONTINUE_WATCHING_KEY);
    } catch (error) {
      console.error('Failed to clear continue watching items:', error);
    }
  }, []);

  return {
    saveProgress,
    getProgress,
    getAllProgress,
    removeProgress,
    clearAll,
  };
};