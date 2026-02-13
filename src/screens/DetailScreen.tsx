import React, { useState, useEffect } from 'react';
import { View, ScrollView, StyleSheet, ActivityIndicator, Text, TouchableOpacity, Alert } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { COLORS, SPACING } from '../constants';
import { DetailScreenProps, TVDetails } from '../types';
import { useContentDetails, useSeasonData, useSubtitlePreferences } from '../hooks';
import { getFebBoxStream, getFebBoxStreamDirect } from '../services/febbox';
import {
  DetailHeader,
  DetailHeroBackdrop,
  DetailActionButtons,
  DetailOverviewSection,
  DetailStatsSection,
  DetailEpisodesSection,
  DetailSeasonPicker,
  DetailCastSection,
  DetailVideosSection,
  DetailSimilarSection,
  DetailShareLinkSection,
} from '../components';
import {
  getYear,
  getRuntime,
  getGenres,
  getRating,
  getTrailers,
  getSimilarContent,
} from '../utils/detailHelpers';

const SHARE_KEY_STORAGE_PREFIX = '@febbox_share_key_';

/**
 * Detail screen for movies and TV shows
 * Displays comprehensive information including cast, episodes, trailers, and similar content
 */
export const DetailScreen: React.FC<DetailScreenProps> = ({ route, navigation }) => {
  const { item } = route.params;

  const mediaType = item.media_type || (item.title ? 'movie' : 'tv');
  const displayTitle = item.title || item.name || 'Unknown Title';
  const isTVShow = mediaType === 'tv';

  // Track selected episode for TV shows
  const [selectedEpisode, setSelectedEpisode] = useState(1);
  const [loadingStream, setLoadingStream] = useState(false);
  const [shareKey, setShareKey] = useState<string | undefined>(); // Store share key

  // Load content details
  const { details, loading, error, loadDetails } = useContentDetails(item.id, mediaType);

  // Load user subtitle preferences
  const { languages: subtitleLanguages } = useSubtitlePreferences();

  // Load season data for TV shows
  const {
    selectedSeason,
    seasonData,
    loadingSeason,
    showSeasonPicker,
    setSelectedSeason,
    setShowSeasonPicker,
  } = useSeasonData(item.id, isTVShow, !!details);

  /**
   * Generate storage key for this content
   */
  const getStorageKey = () => {
    if (isTVShow) {
      return `${SHARE_KEY_STORAGE_PREFIX}${mediaType}_${item.id}_s${selectedSeason}`;
    }
    return `${SHARE_KEY_STORAGE_PREFIX}${mediaType}_${item.id}`;
  };

  /**
   * Load existing share key from storage
   */
  useEffect(() => {
    const loadShareKey = async () => {
      try {
        const storageKey = getStorageKey();
        const savedShareKey = await AsyncStorage.getItem(storageKey);
        if (savedShareKey) {
          console.log('[DetailScreen] Loaded saved share key:', savedShareKey);
          setShareKey(savedShareKey);
        }
      } catch (error) {
        console.error('[DetailScreen] Error loading share key:', error);
      }
    };

    loadShareKey();
  }, [item.id, mediaType, selectedSeason]);

  // Get formatted data
  const year = getYear(details);
  const runtime = getRuntime(details);
  const genres = getGenres(details);
  const rating = getRating(item.vote_average);
  const trailers = getTrailers(details);
  const similarContent = getSimilarContent(details);
  const topCast = details?.credits.cast.slice(0, 15) || [];

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
   * Fetch streaming data using FebBox service
   * Uses direct share key if available, falls back to TMDB-based API
   */
  const fetchStreamingData = async (episodeNumber?: number) => {
    try {
      setLoadingStream(true);

      let result;

      if (shareKey) {
        // Use direct FebBox share key
        console.log('[DetailScreen] Using direct share key:', shareKey);
        result = isTVShow
          ? await getFebBoxStreamDirect(shareKey, 'tv', selectedSeason, episodeNumber || selectedEpisode)
          : await getFebBoxStreamDirect(shareKey, 'movie');
      } else {
        // Fall back to API
        console.log('[DetailScreen] Using TMDB-based API');
        result = isTVShow
          ? await getFebBoxStream(item.id, 'tv', selectedSeason, episodeNumber || selectedEpisode)
          : await getFebBoxStream(item.id, 'movie');
        
        // AUTO-SAVE share key if returned
        if (result.success && result.shareKey) {
          console.log('[DetailScreen] Auto-saving share key from API:', result.shareKey);
          setShareKey(result.shareKey);
          const storageKey = getStorageKey();
          await AsyncStorage.setItem(storageKey, result.shareKey);
        }
      }

      if (!result.success || !result.streamUrl) {
        Alert.alert('Error', result.error || 'Failed to load stream. Please try again.');
        return null;
      }

      return result.streamUrl;
    } catch (error) {
      console.error('Error fetching streaming data:', error);
      Alert.alert('Error', 'Failed to load streaming information. Please try again.');
      return null;
    } finally {
      setLoadingStream(false);
    }
  };

  /**
   * Handle share link submission
   */
  const handleShareLinkSubmit = async (input: string) => {
    try {
      const parsedShareKey = parseShareKey(input);
      
      if (!parsedShareKey) {
        Alert.alert('Error', 'Invalid share link or key');
        return;
      }

      console.log('[DetailScreen] Saving share key:', parsedShareKey);

      // Save to state
      setShareKey(parsedShareKey);

      // Save to AsyncStorage
      const storageKey = getStorageKey();
      await AsyncStorage.setItem(storageKey, parsedShareKey);

    } catch (error) {
      console.error('[DetailScreen] Error saving share key:', error);
      Alert.alert('Error', 'Failed to save share link');
    }
  };

  /**
   * Clear saved share key
   */
  const handleClearShareKey = async () => {
    try {
      setShareKey(undefined);
      const storageKey = getStorageKey();
      await AsyncStorage.removeItem(storageKey);
      Alert.alert('Success', 'Share link cleared');
    } catch (error) {
      console.error('[DetailScreen] Error clearing share key:', error);
    }
  };

  /**
   * Handle navigation to another detail screen
   */
  const handleSimilarItemPress = (similar: any) => {
    navigation.push('Detail', { item: similar });
  };

  /**
   * Handle play button press
   */
  const handlePlay = async () => {
    const streamUrl = await fetchStreamingData();
    
    if (!streamUrl) {
      return;
    }

    const subtitle = isTVShow 
      ? `S${selectedSeason}:E${selectedEpisode}` 
      : year;
    
    navigation.navigate('Player', {
      videoUrl: streamUrl,
      title: displayTitle,
      subtitle,
      subtitles: subtitleLanguages.map(lang => ({
        title: lang.name,
        language: lang.code,
        uri: '',
      })),
      tmdbId: item.id,
      mediaType,
      season: isTVShow ? selectedSeason : undefined,
      episode: isTVShow ? selectedEpisode : undefined,
    });
  };

  /**
   * Handle episode selection and play
   */
  const handleEpisodePress = async (episodeNumber: number) => {
    setSelectedEpisode(episodeNumber);
    const streamUrl = await fetchStreamingData(episodeNumber);
    
    if (!streamUrl) {
      return;
    }

    const subtitle = `S${selectedSeason}:E${episodeNumber}`;
    
    navigation.navigate('Player', {
      videoUrl: streamUrl,
      title: displayTitle,
      subtitle,
      subtitles: subtitleLanguages.map(lang => ({
        title: lang.name,
        language: lang.code,
        uri: '', 
      })),
      tmdbId: item.id,
      mediaType,
      season: selectedSeason,
      episode: episodeNumber,
    });
  };

  // Loading state
  if (loading) {
    return (
      <View style={styles.container}>
        <LinearGradient colors={COLORS.backgroundGradient} style={styles.gradient}>
          <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
            <DetailHeader onClose={() => navigation.goBack()} />
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={COLORS.text} />
            </View>
          </SafeAreaView>
        </LinearGradient>
      </View>
    );
  }

  // Error state
  if (error || !details) {
    return (
      <View style={styles.container}>
        <LinearGradient colors={COLORS.backgroundGradient} style={styles.gradient}>
          <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
            <DetailHeader onClose={() => navigation.goBack()} />
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>Failed to load details</Text>
              <TouchableOpacity style={styles.retryButton} onPress={loadDetails}>
                <Text style={styles.retryText}>Retry</Text>
              </TouchableOpacity>
            </View>
          </SafeAreaView>
        </LinearGradient>
      </View>
    );
  }

  const numberOfSeasons =
    isTVShow && 'number_of_seasons' in details.details
      ? (details.details as TVDetails).number_of_seasons
      : 0;

  return (
    <View style={styles.container}>
      {loadingStream && (
        <View style={styles.streamLoadingOverlay}>
          <ActivityIndicator size="large" color={COLORS.text} />
          <Text style={styles.streamLoadingText}>Loading stream...</Text>
        </View>
      )}
      
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Hero Section with Backdrop */}
        <View>
          <DetailHeroBackdrop
            backdropPath={item.backdrop_path}
            posterPath={item.poster_path}
            title={displayTitle}
            tagline={details.details.tagline}
            year={year}
            runtime={runtime}
            rating={rating}
          />
          <DetailHeader onClose={() => navigation.goBack()} />
        </View>

        {/* Action Buttons */}
        <DetailActionButtons 
          onPlay={handlePlay}
          itemId={item.id}
          title={displayTitle}
        />

        {/* Overview */}
        <DetailOverviewSection overview={details.details.overview} />

        {/* Stats */}
        <DetailStatsSection details={details} genres={genres} />

        {/* Episodes (TV Shows Only) */}
        {isTVShow && numberOfSeasons > 0 && (
          <DetailEpisodesSection
            selectedSeason={selectedSeason}
            episodes={seasonData?.episodes}
            loadingSeason={loadingSeason}
            onSeasonPickerOpen={() => setShowSeasonPicker(true)}
            onEpisodePress={handleEpisodePress}
            selectedEpisode={selectedEpisode}
          />
        )}

        {/* Season Picker Modal */}
        {isTVShow && numberOfSeasons > 0 && (
          <DetailSeasonPicker
            visible={showSeasonPicker}
            numberOfSeasons={numberOfSeasons}
            selectedSeason={selectedSeason}
            onSeasonSelect={(season) => {
              setSelectedSeason(season);
              setSelectedEpisode(1); // Reset to episode 1 when changing seasons
            }}
            onClose={() => setShowSeasonPicker(false)}
          />
        )}

        {/* Cast */}
        <DetailCastSection cast={topCast} />

        {/* Videos/Trailers */}
        <DetailVideosSection videos={trailers} />

        {/* Share Link Input */}
        <DetailShareLinkSection
          onSubmit={handleShareLinkSubmit}
          onClear={shareKey ? handleClearShareKey : undefined}
          mediaType={mediaType}
          season={isTVShow ? selectedSeason : undefined}
          episode={isTVShow ? selectedEpisode : undefined}
          existingShareKey={shareKey}
        />

        {/* Similar Content */}
        <DetailSimilarSection
          similarContent={similarContent}
          mediaType={mediaType}
          onItemPress={handleSimilarItemPress}
        />

        <View style={{ height: SPACING.xxl }} />
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollView: {
    flex: 1,
  },
  gradient: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
  },
  errorText: {
    fontSize: 18,
    color: COLORS.textMuted,
    marginBottom: SPACING.lg,
  },
  retryButton: {
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.md,
    backgroundColor: COLORS.overlayStrong,
    borderRadius: 8,
  },
  retryText: {
    fontSize: 16,
    color: COLORS.text,
    fontWeight: '600',
  },
  streamLoadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  streamLoadingText: {
    marginTop: SPACING.md,
    fontSize: 16,
    color: COLORS.text,
    fontWeight: '500',
  },
});