import React, { useState } from 'react';
import { View, ScrollView, StyleSheet, ActivityIndicator, Text, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS, SPACING } from '../constants';
import { DetailScreenProps, TVDetails } from '../types';
import { useContentDetails, useSeasonData } from '../hooks';
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

  // Load season data for TV shows
  const {
    selectedSeason,
    seasonData,
    loadingSeason,
    showSeasonPicker,
    setSelectedSeason,
    setShowSeasonPicker,
  } = useSeasonData(item.id, isTVShow, !!details);

  // Get formatted data
  const year = getYear(details);
  const runtime = getRuntime(details);
  const genres = getGenres(details);
  const rating = getRating(item.vote_average);
  const trailers = getTrailers(details);
  const similarContent = getSimilarContent(details);
  const topCast = details?.credits.cast.slice(0, 15) || [];

  /**
   * Construct streaming URL based on media type
   */
  const getStreamingUrl = (episodeNumber?: number): string => {
    if (isTVShow) {
      const episode = episodeNumber || selectedEpisode;
      return `https://streams.icefy.top/tv/${item.id}/${selectedSeason}/${episode}/bump/master.m3u8`;
    } else {
      return `https://streams.icefy.top/movie/${item.id}/bump/master.m3u8`;
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
  const handlePlay = () => {
    const videoUrl = getStreamingUrl();
    const subtitle = isTVShow 
      ? `S${selectedSeason}:E${selectedEpisode}` 
      : year;
    
    navigation.navigate('Player', {
      videoUrl,
      title: displayTitle,
      subtitle,
      subtitles: [
        {
          title: 'Spanish',
          language: 'en',
          uri: 'https://images.febbox.com/subtilte/2026/01/29/697c1bf68ef78.srt',
        },
        {
          title: 'French',
          language: 'fr',
          uri: 'https://images.febbox.com/subtilte/2026/01/29/697bc21f29da9.srt',
        },
      ],
    });
  };

  /**
   * Handle episode selection and play
   */
  const handleEpisodePress = (episodeNumber: number) => {
    setSelectedEpisode(episodeNumber);
    const videoUrl = getStreamingUrl(episodeNumber);
    const subtitle = `S${selectedSeason}:E${episodeNumber}`;
    
    navigation.navigate('Player', {
      videoUrl,
      title: displayTitle,
      subtitle,
      subtitles: [
        {
          title: 'Spanish',
          language: 'en',
          uri: 'https://images.febbox.com/subtilte/2026/01/29/697c1bf68ef78.srt',
        },
        {
          title: 'French',
          language: 'fr',
          uri: 'https://images.febbox.com/subtilte/2026/01/29/697bc21f29da9.srt',
        },
      ],
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
});