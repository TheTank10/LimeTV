import React from 'react';
import { View, Image, Text, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Movie } from '../types';
import { getBackdropUrl, getDisplayTitle } from '../utils';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS, SHADOWS } from '../constants';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

interface Props {
  item: Movie | null;
  loading?: boolean;
}

export const HeroSection: React.FC<Props> = ({ item, loading = false }) => {
  const navigation = useNavigation<NavigationProp>();
  const screenWidth = Dimensions.get('window').width;
  const heroHeight = (screenWidth * 9) / 16;

  if (loading || !item) {
    return (
      <View style={styles.wrapper}>
        <View style={[styles.container, { height: heroHeight }]}>
          <View style={styles.skeleton} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.wrapper}>
      <View style={[styles.container, { height: heroHeight }]}>
        {item.backdrop_path && (
          <Image
            source={{
              uri: getBackdropUrl(item.backdrop_path),
              cache: 'force-cache',
            }}
            style={styles.image}
            resizeMode="cover"
            fadeDuration={300}
          />
        )}
        <LinearGradient
          colors={[
            'transparent',
            'transparent', 
            'rgba(0,0,0,0.4)',
            'rgba(0,0,0,0.85)',
            'rgba(0,0,0,0.98)'
          ]}
          locations={[0, 0.3, 0.5, 0.8, 1]}
          style={styles.gradient}
        >
          <Text style={styles.title} numberOfLines={2}>
            {getDisplayTitle(item)}
          </Text>
          <TouchableOpacity 
            style={styles.button} 
            onPress={() => item && navigation.navigate('Detail', { item })}
            activeOpacity={0.7}
          >
            <BlurView intensity={30} style={styles.buttonBlur}>
              <Text style={styles.buttonText}>▶  Watch Now</Text>
            </BlurView>
          </TouchableOpacity>
        </LinearGradient>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    paddingHorizontal: SPACING.lg,
    marginBottom: SPACING.lg,
  },
  container: {
    overflow: 'hidden',
    borderRadius: BORDER_RADIUS.xl,
    backgroundColor: '#000',
    ...SHADOWS.glow,
    elevation: 12,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  skeleton: {
    width: '100%',
    height: '100%',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  gradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '65%',
    justifyContent: 'flex-end',
    paddingHorizontal: SPACING.xl,
    paddingBottom: SPACING.xl,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: SPACING.sm,
    textShadowColor: 'rgba(0, 0, 0, 0.9)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
  },
  button: {
    alignSelf: 'flex-start',
    borderRadius: BORDER_RADIUS.sm,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
  },
  buttonBlur: {
    paddingVertical: 8,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
});