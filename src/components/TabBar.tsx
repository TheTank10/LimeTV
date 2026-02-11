import React from 'react';
import { View, TouchableOpacity, Text, Animated, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { MediaType } from '../types';
import { COLORS, SPACING, FONT_SIZES } from '../constants';

interface Props {
  selectedTab: MediaType;
  onTabChange: (tab: MediaType) => void;
  onSettingsPress?: () => void;
  opacity?: Animated.Value;
  scale?: Animated.Value;
  translateY?: Animated.Value;
}

export const TabBar: React.FC<Props> = ({ 
  selectedTab, 
  onTabChange, 
  onSettingsPress,
  opacity, 
  scale, 
  translateY 
}) => {
  const tabs: { key: MediaType; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'movie', label: 'Movies' },
    { key: 'tv', label: 'Shows' },
  ];

  const animatedStyle = {
    opacity: opacity || 1,
    transform: [
      { scale: scale || 1 },
      { translateY: translateY || 0 },
    ],
  };

  return (
    <Animated.View style={[styles.container, animatedStyle]}>
      {tabs.map((tab) => (
        <TouchableOpacity
          key={tab.key}
          style={styles.tab}
          onPress={() => onTabChange(tab.key)}
        >
          <Text
            style={[styles.tabText, selectedTab === tab.key && styles.tabTextActive]}
          >
            {tab.label}
          </Text>
          {selectedTab === tab.key && <View style={styles.indicator} />}
        </TouchableOpacity>
      ))}
      
      {/* Settings Tab */}
      <TouchableOpacity
        style={styles.tab}
        onPress={onSettingsPress}
      >
        <View style={styles.settingsTab}>
          <Ionicons name="settings-outline" size={16} color={COLORS.textDark} />
          <Text style={styles.tabText}>Settings</Text>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    gap: 4,
  },
  tab: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    position: 'relative',
  },
  tabText: {
    color: COLORS.textDark,
    fontSize: FONT_SIZES.sm,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  tabTextActive: {
    color: COLORS.text,
  },
  indicator: {
    position: 'absolute',
    bottom: 0,
    left: 16,
    right: 16,
    height: 2,
    backgroundColor: COLORS.text,
    borderRadius: 2,
  },
  settingsTab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
});