import { useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SubtitleLanguage } from '../types';

const LANGUAGES_STORAGE_KEY = '@subtitle_languages';

export const useSubtitlePreferences = () => {
  const [languages, setLanguages] = useState<SubtitleLanguage[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadLanguages();
  }, []);

  const loadLanguages = async () => {
    try {
      const stored = await AsyncStorage.getItem(LANGUAGES_STORAGE_KEY);
      if (stored) {
        const savedLanguages: SubtitleLanguage[] = JSON.parse(stored);
        setLanguages(savedLanguages);
      }
    } catch (error) {
      console.error('Error loading subtitle preferences:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return {
    languages,
    isLoading,
  };
};