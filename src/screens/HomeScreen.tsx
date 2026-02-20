import React, { useState, useRef } from 'react';
import { View, ScrollView, Text, StyleSheet, NativeSyntheticEvent, NativeScrollEvent } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { MediaType, RootStackParamList } from '../types';
import { useContentLoader, useSearch, useScrollAnimation } from '../hooks';
import { Header, HeroSection, CategoryRow, PosterCard, ScrollToTopButton  } from '../components';
import { COLORS, SPACING } from '../constants';

import type { NativeStackNavigationProp } from '@react-navigation/native-stack';


type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

/**
 * Main home screen
 * Displays hero section, category rows, and search functionality
 */
export const HomeScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const [selectedTab, setSelectedTab] = useState<MediaType>('all');
  const scrollViewRef = useRef<ScrollView>(null);
  const [showScrollTop, setShowScrollTop] = useState(false);

  // Load content based on selected tab
  const { heroItem, categories, heroLoading, reload } = useContentLoader(selectedTab);

  // Search functionality
  const { query, results, isSearching, handleSearch, clearSearch } = useSearch();

  // Scroll animations
  const { animations, handleScroll, resetAnimations } = useScrollAnimation();
  const lastUpdateRef = useRef<string>('0');

  // Update if "My List" has changed
  useFocusEffect(
    React.useCallback(() => {
      AsyncStorage.getItem('@mylist_updated').then((timestamp) => {
        if (timestamp && timestamp !== lastUpdateRef.current) {
          lastUpdateRef.current = timestamp;
          reload();
        }
      });
    }, [reload])
  );

  /**
   * Handle tab change
   */
  const handleTabChange = (tab: MediaType) => {
    setSelectedTab(tab);
    // Scroll to top when changing tabs
    scrollViewRef.current?.scrollTo({ y: 0, animated: true });
  };

  /**
   * Handle search clear
   */
  const handleClearSearch = () => {
    clearSearch();
    resetAnimations();
  };

  const handleScrollEvent = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const currentScrollY = event.nativeEvent.contentOffset.y;
    setShowScrollTop(currentScrollY > 300);
    handleScroll(event);
  };

  const scrollToTop = () => {
    scrollViewRef.current?.scrollTo({ y: 0, animated: true });
  };

  /**
   * Render search results
   */
  const renderSearchResults = () => {
    if (results.length === 0) {
      return (
        <View style={styles.noResults}>
          <Text style={styles.noResultsText}>No results found</Text>
        </View>
      );
    }

    // Group results into rows of 6
    return Array.from({ length: Math.ceil(results.length / 6) }).map((_, rowIndex) => {
      const startIndex = rowIndex * 6;
      const rowItems = results.slice(startIndex, startIndex + 6);

      return (
        <View key={rowIndex} style={styles.categoryContainer}>
          <Text style={styles.categoryTitle}>
            {rowIndex === 0 ? 'Search Results' : 'More Results'}
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.posterRow}
          >
            {rowItems.map((item) => (
              <PosterCard 
                key={item.id} 
                item={item}
                onPress={() => navigation.navigate('Detail', { item })}
              />
            ))}
          </ScrollView>
        </View>
      );
    });
  };

  return (
    <View style={styles.container}>
      <LinearGradient colors={COLORS.backgroundGradient} style={styles.gradient}>
        <SafeAreaView style={styles.safeArea} edges={['top']}>
          {/* Header */}
          <Header
            selectedTab={selectedTab}
            onTabChange={handleTabChange}
            searchQuery={query}
            onSearchChange={handleSearch}
            onSearchClear={handleClearSearch}
            isSearching={isSearching}
            animations={animations}
            onSettingsPress={() => navigation.navigate('Settings')}
          />

          {/* Content */}
          <ScrollView
            ref={scrollViewRef}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
            onScroll={handleScrollEvent}
            scrollEventThrottle={16}
          >
            {isSearching ? (
              // Search Results
              renderSearchResults()
            ) : (
              <>
                {/* Hero Section */}
                <HeroSection item={heroItem} loading={heroLoading} />

                {/* Category Rows */}
                {categories.map((category, index) => (
                  <CategoryRow key={index} category={category} />
                ))}
              </>
            )}
          </ScrollView>
        <ScrollToTopButton visible={showScrollTop} onPress={scrollToTop} />
        </SafeAreaView>
      </LinearGradient>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  gradient: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: 140, 
    paddingBottom: SPACING.xl,
  },
  categoryContainer: {
    marginBottom: 25,
  },
  categoryTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.text,
    marginLeft: SPACING.lg,
    marginBottom: 12,
    textShadowColor: 'rgba(255, 255, 255, 0.8)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 15,
  },
  posterRow: {
    paddingLeft: SPACING.lg,
    paddingRight: 10,
  },
  noResults: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 100,
  },
  noResultsText: {
    color: COLORS.textDark,
    fontSize: 16,
  },
});