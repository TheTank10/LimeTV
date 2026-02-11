import { useRef } from 'react';
import { Animated } from 'react-native';

/**
 * Hook for animating header elements based on scroll position
 * Hides search bar, dims logo and tabs when scrolling down
 * 
 * Usage:
 *   const { animations, handleScroll } = useScrollAnimation();
 *   <ScrollView onScroll={handleScroll} scrollEventThrottle={16}>
 */
export const useScrollAnimation = () => {
  // Animation values (using native driver)
  const searchBarScale = useRef(new Animated.Value(1)).current;
  const searchBarTranslate = useRef(new Animated.Value(0)).current;
  const logoOpacity = useRef(new Animated.Value(1)).current;
  const tabsOpacity = useRef(new Animated.Value(1)).current;
  const tabsScale = useRef(new Animated.Value(1)).current;
  const tabsTranslate = useRef(new Animated.Value(0)).current;
  const headerOpacity = useRef(new Animated.Value(1)).current; // NEW - for blur backdrop

  // Tracking state
  const lastScrollY = useRef(0);
  const isSearchBarHidden = useRef(false);

  /**
   * Handle scroll events
   */
  const handleScroll = (event: any) => {
    const currentScrollY = event.nativeEvent.contentOffset.y;

    if (currentScrollY > 10 && !isSearchBarHidden.current) {
      // NOT at top - hide search bar
      isSearchBarHidden.current = true;
      Animated.parallel([
        Animated.timing(searchBarScale, {
          toValue: 0,
          duration: 100,
          useNativeDriver: true,
        }),
        Animated.timing(searchBarTranslate, {
          toValue: -25,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(tabsScale, {
          toValue: 0,
          duration: 100,
          useNativeDriver: true,
        }),
        Animated.timing(tabsTranslate, {
          toValue: -20,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(logoOpacity, {
          toValue: 0.1,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(tabsOpacity, {
          toValue: 0.8,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(headerOpacity, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    } else if (currentScrollY <= 10 && isSearchBarHidden.current) {
      // AT THE TOP - show search bar
      isSearchBarHidden.current = false;
      Animated.parallel([
        Animated.timing(searchBarScale, {
          toValue: 1,
          duration: 150,
          useNativeDriver: true,
        }),
        Animated.timing(searchBarTranslate, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(tabsScale, {
          toValue: 1,
          duration: 150,
          useNativeDriver: true,
        }),
        Animated.timing(logoOpacity, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(headerOpacity, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    }

    lastScrollY.current = currentScrollY;
  };

  /**
   * Reset animations to default state
   */
  const resetAnimations = () => {
    isSearchBarHidden.current = false;
    Animated.parallel([
      Animated.timing(searchBarScale, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(searchBarTranslate, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(tabsScale, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(logoOpacity, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(headerOpacity, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start();
  };

  return {
    animations: {
      searchBarScale,
      searchBarTranslate,
      logoOpacity,
      tabsOpacity,
      tabsScale,
      tabsTranslate,
      headerOpacity,
    },
    handleScroll,
    resetAnimations,
  };
};