import React, { useState, useEffect } from 'react';
import { View, TouchableOpacity, Text, StyleSheet, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SPACING, COLORS, FONT_SIZES, BORDER_RADIUS } from '../constants';

interface DetailActionButtonsProps {
  onPlay: () => void;
  itemId: number;
  title: string;
}

const MY_LIST_KEY = '@limetv_my_list';

/**
 * Action buttons for detail screen (Play, My List, Share)
 */
export const DetailActionButtons: React.FC<DetailActionButtonsProps> = ({ 
  onPlay, 
  itemId,
  title 
}) => {
  const [isInList, setIsInList] = useState(false);
  const [loading, setLoading] = useState(false);

  // Check if item is in list on mount
  useEffect(() => {
    checkIfInList();
  }, [itemId]);

  const checkIfInList = async () => {
    try {
      const myListJson = await AsyncStorage.getItem(MY_LIST_KEY);
      if (myListJson) {
        const myList = JSON.parse(myListJson);
        setIsInList(myList.includes(itemId));
      }
    } catch (error) {
      console.error('Error checking list:', error);
    }
  };

  const handleMyListToggle = async () => {
    try {
      setLoading(true);
      const myListJson = await AsyncStorage.getItem(MY_LIST_KEY);
      let myList: number[] = myListJson ? JSON.parse(myListJson) : [];

      if (isInList) {
        // Remove from list
        myList = myList.filter(id => id !== itemId);
        setIsInList(false);
      } else {
        // Add to list
        myList.push(itemId);
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

  const handleShare = () => {
    Alert.alert('Share', 'Share functionality coming soon');
  };

  return (
    <View style={styles.actionButtons}>
      <TouchableOpacity style={styles.playButton} onPress={onPlay}>
        <Text style={styles.playButtonText}>▶  Play</Text>
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