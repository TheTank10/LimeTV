import React, { useState, useEffect, useRef } from 'react';
import { View, Image, Text, TouchableOpacity, Animated, StyleSheet } from 'react-native';

import { Movie } from '../../types';
import { getPosterUrl } from '../../utils';
import { COLORS, BORDER_RADIUS } from '../../constants';

interface Props {
  item: Movie;
  onPress?: () => void;
}

/**
 * Poster card component with loading animation
 * Shows movie/TV poster with shimmer effect while loading
 */
export const PosterCard: React.FC<Props> = ({ item, onPress }) => {
  const [imageLoaded, setImageLoaded] = useState(false);
  const pulseAnim = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    if (!imageLoaded) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 0.3,
            duration: 800,
            useNativeDriver: true,
          }),
        ])
      ).start();
    }
  }, [imageLoaded, pulseAnim]);

  return (
    <TouchableOpacity style={styles.card} onPress={onPress}>
      <View style={styles.container}>
        {item.poster_path ? (
          <>
            <Image
              source={{
                uri: getPosterUrl(item.poster_path),
                cache: 'force-cache',
              }}
              style={styles.poster}
              onLoad={() => setImageLoaded(true)}
              resizeMode="cover"
              fadeDuration={200}
            />
            {!imageLoaded && (
              <Animated.View style={[styles.loadingOverlay, { opacity: pulseAnim }]}>
                <View style={styles.shimmer} />
              </Animated.View>
            )}
          </>
        ) : (
          <View style={[styles.poster, styles.noPoster]}>
            <Text style={styles.noPosterText}>No Image</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    marginRight: 10,
  },
  container: {
    width: 125,
    height: 188,
    position: 'relative',
  },
  poster: {
    width: 125,
    height: 188,
    borderRadius: BORDER_RADIUS.sm,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: COLORS.shimmer,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: BORDER_RADIUS.md,
  },
  shimmer: {
    width: '100%',
    height: '100%',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: BORDER_RADIUS.md,
  },
  noPoster: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  noPosterText: {
    color: COLORS.textDark,
    fontSize: 10,
    textAlign: 'center',
  },
});