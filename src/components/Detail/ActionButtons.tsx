import React, { useState, useEffect, useCallback } from 'react';
import { View, TouchableOpacity, Text, StyleSheet, Alert, Share, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { SPACING, COLORS, FONT_SIZES, BORDER_RADIUS } from '../../constants';
import { useContinueWatching } from '../../hooks';
import { ContinueWatchingItem } from '../../types';

interface DetailActionButtonsProps {
  onPlay: () => void;
  itemId: number;
  title: string;
  mediaType: 'movie' | 'tv';
  shareKey?: string;
}

interface StoredListItem {
  id: number;
  type?: 'movie' | 'tv';
  mediaType?: 'movie' | 'tv';
}

const MY_LIST_KEY = '@limetv_my_list';

/**
 * Action buttons for detail screen (Play, My List, Share)
 */
export const DetailActionButtons: React.FC<DetailActionButtonsProps> = ({ 
  onPlay, 
  itemId,
  title,
  mediaType,
  shareKey,
}) => {
  const [isInList, setIsInList] = useState(false);
  const [loading, setLoading] = useState(false);
  const [continueWatchingData, setContinueWatchingData] = useState<ContinueWatchingItem | null>(null);
  
  const { getProgress } = useContinueWatching();

  const checkIfInList = useCallback(async () => {
    try {
      const myListJson = await AsyncStorage.getItem(MY_LIST_KEY);
      if (myListJson) {
        const myList = JSON.parse(myListJson) as Array<number | StoredListItem>;
        const inList = myList.some((item) => {
          if (typeof item === 'object' && item !== null) {
            return item.id === itemId && (item.type === mediaType || item.mediaType === mediaType);
          }
          return item === itemId;
        });
        setIsInList(inList);
      }
    } catch (error) {
      console.error('Error checking list:', error);
    }
  }, [itemId, mediaType]);

  const checkContinueWatching = useCallback(async () => {
    try {
      const progress = await getProgress(itemId);
      setContinueWatchingData(progress);
    } catch (error) {
      console.error('Error checking continue watching:', error);
    }
  }, [itemId, getProgress]);

  useEffect(() => {
    checkIfInList();
    checkContinueWatching();
  }, [itemId, checkIfInList, checkContinueWatching]);

  const handleMyListToggle = async () => {
    try {
      setLoading(true);
      const myListJson = await AsyncStorage.getItem(MY_LIST_KEY);
      let myList = (myListJson ? JSON.parse(myListJson) : []) as Array<number | StoredListItem>;

      if (isInList) {
        // Remove from list
        myList = myList.filter((item) => {
          if (typeof item === 'object' && item !== null) {
            const matchesId = item.id === itemId;
            const matchesType = item.type === mediaType || item.mediaType === mediaType;
            return !(matchesId && matchesType);
          }
          return item !== itemId;
        });
        setIsInList(false);
      } else {
        // Add to list with type
        myList.push({ id: itemId, type: mediaType });
        setIsInList(true);
      }

      await AsyncStorage.setItem(MY_LIST_KEY, JSON.stringify(myList));
      await AsyncStorage.setItem('@mylist_updated', Date.now().toString());
    } catch (error) {
      console.error('Error updating list:', error);
      Alert.alert('Error', 'Could not update your list');
    } finally {
      setLoading(false);
    }
  };

  const handleShare = async () => {
    try {
      let url = `https://TheTank10.github.io/LimeTV/?id=${itemId}&type=${mediaType}`;

      if (title) {
        url += `&title=${encodeURIComponent(title)}`;
      }

      if (shareKey) {
        url += `&shareKey=${encodeURIComponent(shareKey)}`;
      }

      await Share.share(
        Platform.OS === 'ios'
          ? { url }
          : { message: url }
      );
    } catch {
      // Share dismissed or failed — silently ignore
    }
  };

  // Format play button text based on continue watching data
  const getPlayButtonText = () => {
    if (!continueWatchingData) {
      return '▶  Play';
    }

    const { season, episode, mediaType } = continueWatchingData;
    
    // For TV shows with season/episode info
    if (mediaType === 'tv' && season !== undefined && episode !== undefined) {
      const seasonStr = season.toString().padStart(2, '0');
      const episodeStr = episode.toString().padStart(2, '0');
      return `▶  Continue S${seasonStr}E${episodeStr}`;
    }
    
    // For movies or TV shows without episode info
    return '▶  Continue';
  };

  return (
    <View style={styles.actionButtons}>
      <TouchableOpacity style={styles.playButton} onPress={onPlay}>
        <Text style={styles.playButtonText}>{getPlayButtonText()}</Text>
      </TouchableOpacity>
      
      <TouchableOpacity 
        style={[styles.iconButton, loading && styles.iconButtonDisabled]} 
        onPress={handleMyListToggle}
        disabled={loading}
      >
        <Text style={styles.iconButtonText}>
          {isInList ? '✓' : '+'}
        </Text>
        <Text style={styles.iconButtonLabel}>My List</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.iconButton} onPress={handleShare}>
        <Text style={styles.iconButtonText}>↗</Text>
        <Text style={styles.iconButtonLabel}>Share</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  actionButtons: {
    flexDirection: 'row',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.lg,
    gap: SPACING.md,
  },
  playButton: {
    flex: 1,
    backgroundColor: COLORS.buttonLight,
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playButtonText: {
    fontSize: FONT_SIZES.lg,
    fontWeight: 'bold',
    color: COLORS.buttonDark,
  },
  iconButton: {
    backgroundColor: COLORS.overlay,
    width: 70,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconButtonDisabled: {
    opacity: 0.5,
  },
  iconButtonText: {
    fontSize: 24,
    color: COLORS.text,
    marginBottom: 2,
    fontWeight: 'bold',
  },
  iconButtonLabel: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textMuted,
  },
});