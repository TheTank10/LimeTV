import React, { useState, useEffect } from 'react';
import { View, ScrollView, StyleSheet, ActivityIndicator, Text, TouchableOpacity, Alert } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS, SPACING } from '../constants';
import { DetailScreenProps, TVDetails } from '../types';
import { 
  useContentDetails, 
  useSeasonData, 
  useSubtitlePreferences, 
  useContinueWatching,
  useShareKey,
  useStreamFetcher
} from '../hooks';
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

  // Load content details
  const { details, loading, error, loadDetails } = useContentDetails(item.id, mediaType);

  // Load user subtitle preferences
  const { languages: subtitleLanguages } = useSubtitlePreferences();

  // Continue watching
  const { getProgress } = useContinueWatching();
  const [continueWatchingData, setContinueWatchingData] = useState<any>(null);

  // Load season data for TV shows
  const {
    selectedSeason,
    seasonData,
    loadingSeason,
    showSeasonPicker,
    setSelectedSeason,
    setShowSeasonPicker,
  } = useSeasonData(item.id, isTVShow, !!details);

  // Share key management
  const { shareKey, saveShareKey, updateShareKey, clearShareKey } = useShareKey({
    itemId: item.id,
    mediaType,
    selectedSeason,
  });

  // Stream fetching
  const { fetchStream, loading: loadingStream } = useStreamFetcher({
    itemId: item.id,
    mediaType,
    shareKey,
    onShareKeyUpdate: updateShareKey,
  });

  // Get formatted data
  const year = getYear(details);
  const runtime = getRuntime(details);
  const genres = getGenres(details);
  const rating = getRating(item.vote_average);
  const trailers = getTrailers(details);
  const similarContent = getSimilarContent(details);
  const topCast = details?.credits.cast.slice(0, 15) || [];

  /**
   * Load continue watching data on mount
   */
  useEffect(() => {
    const loadContinueWatching = async () => {
      try {
        const progress = await getProgress(item.id);
        setContinueWatchingData(progress);
        
        // If TV show, update selected season/episode from continue watching
        if (progress && isTVShow && progress.season && progress.episode) {
          setSelectedSeason(progress.season);
          setSelectedEpisode(progress.episode);
        }
      } catch (error) {
        console.error('[DetailScreen] Error loading continue watching:', error);
      }
    };

    loadContinueWatching();
  }, [item.id]);

  /**
   * Get resume timestamp for current episode/movie
   */
  const getResumeTimestamp = (): number | undefined => {
    if (!continueWatchingData) return undefined;

    // For movies, always use the saved timestamp
    if (!isTVShow) {
      return continueWatchingData.timestamp;
    }

    // For TV shows, only use timestamp if it matches current season/episode
    if (
      continueWatchingData.season === selectedSeason &&
      continueWatchingData.episode === selectedEpisode
    ) {
      return continueWatchingData.timestamp;
    }

    return undefined;
  };

  /**
   * Handle share link submission
   */
  const handleShareLinkSubmit = async (input: string) => {
    const success = await saveShareKey(input);
    if (!success) {
      Alert.alert('Error', 'Invalid share link or key');
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
    const streamUrl = await fetchStream(
      isTVShow ? selectedSeason : undefined,
      isTVShow ? selectedEpisode : undefined
    );
    
    if (!streamUrl) return;

    const subtitle = isTVShow 
      ? `S${selectedSeason}:E${selectedEpisode}` 
      : year;
    
    const resumeTimestamp = getResumeTimestamp();

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
      resumeTimestamp,
    });
  };

  /**
   * Handle episode selection and play
   */
  const handleEpisodePress = async (episodeNumber: number) => {
    setSelectedEpisode(episodeNumber);
    const streamUrl = await fetchStream(selectedSeason, episodeNumber);
    
    if (!streamUrl) return;

    const subtitle = `S${selectedSeason}:E${episodeNumber}`;
    
    // Check if we have progress for this specific episode
    let resumeTimestamp: number | undefined;
    if (
      continueWatchingData &&
      continueWatchingData.season === selectedSeason &&
      continueWatchingData.episode === episodeNumber
    ) {
      resumeTimestamp = continueWatchingData.timestamp;
    }
    
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
      resumeTimestamp,
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
          onClear={shareKey ? clearShareKey : undefined}
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