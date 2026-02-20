import React from 'react';
import { View, Animated, StyleSheet } from 'react-native';
import { BlurView } from 'expo-blur';

import { MediaType } from '../../types';
import { COLORS, SPACING } from '../../constants';

import { TabBar } from './TabBar';
import { SearchBar } from './SearchBar';

interface Props {
  selectedTab: MediaType;
  onTabChange: (tab: MediaType) => void;
  searchQuery: string;
  onSearchChange: (text: string) => void;
  onSearchClear: () => void;
  isSearching: boolean;
  onSettingsPress?: () => void;
  animations?: {
    searchBarScale: Animated.Value;
    searchBarTranslate: Animated.Value;
    logoOpacity: Animated.Value;
    tabsOpacity: Animated.Value;
    tabsScale: Animated.Value;
    tabsTranslate: Animated.Value;
    headerOpacity: Animated.Value;
  };
}

export const Header: React.FC<Props> = ({
  selectedTab,
  onTabChange,
  searchQuery,
  onSearchChange,
  onSearchClear,
  isSearching,
  onSettingsPress,
  animations,
}) => {
  return (
    <Animated.View style={[styles.wrapper, { opacity: animations?.headerOpacity || 1 }]}>
      <BlurView intensity={95} tint="dark" style={styles.blurContainer}>
        <View style={styles.container}>
        {/* Logo */}

        {/* Tabs (hidden when searching) */}
        {!isSearching && (
          <Animated.View
            style={{
              transform: [
                { scale: animations?.tabsScale || 1 }
              ],
              marginTop: 16,
            }}
          >
            <TabBar
              selectedTab={selectedTab}
              onTabChange={onTabChange}
              onSettingsPress={onSettingsPress}
              opacity={animations?.tabsOpacity}
            />
          </Animated.View>
        )}

        {/* Search Bar */}
        <SearchBar
          value={searchQuery}
          onChangeText={onSearchChange}
          onClear={onSearchClear}
          scale={animations?.searchBarScale}
          translateY={animations?.searchBarTranslate}
        />
      </View>
    </BlurView>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
  },
  blurContainer: {
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  container: {
    paddingTop: 45,
    paddingHorizontal: SPACING.lg,
    paddingBottom: 8,
  },
  logo: {
    fontSize: 24,
    fontWeight: '800',
    color: COLORS.text,
    letterSpacing: 2,
  },
});