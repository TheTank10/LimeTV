import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import * as HomeIndicatorController from 'home-indicator-controller';

export function useHomeIndicatorAutoHide(inactivityDelay: number = 3000) {
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const hideIndicator = () => {
    if (Platform.OS === 'ios') {
      HomeIndicatorController.setAutoHidden(true);
    }
  };

  const showIndicator = () => {
    if (Platform.OS === 'ios') {
      HomeIndicatorController.setAutoHidden(false);
    }
  };

  const resetTimer = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    
    showIndicator();
    
    timeoutRef.current = setTimeout(() => {
      hideIndicator();
    }, inactivityDelay);
  };

  useEffect(() => {
    resetTimer();
    
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      showIndicator();
    };
  }, [inactivityDelay]);

  return { resetTimer, showIndicator, hideIndicator };
}