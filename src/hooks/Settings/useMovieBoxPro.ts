import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const MOVIEBOXPRO_MOVIES_STORAGE_KEY = '@use_movieboxpro_movies';

export const useMovieBoxPro = () => {
  const [useMovieBoxProForMovies, setUseMovieBoxProForMovies] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const loadSetting = async () => {
    try {
      const stored = await AsyncStorage.getItem(MOVIEBOXPRO_MOVIES_STORAGE_KEY);
      if (stored !== null) {
        setUseMovieBoxProForMovies(JSON.parse(stored));
      }
      setIsLoading(false);
    } catch (error) {
      console.error('Error loading MovieBoxPro setting:', error);
      setIsLoading(false);
    }
  };

  const saveSetting = useCallback(async () => {
    try {
      await AsyncStorage.setItem(MOVIEBOXPRO_MOVIES_STORAGE_KEY, JSON.stringify(useMovieBoxProForMovies));
    } catch (error) {
      console.error('Error saving MovieBoxPro setting:', error);
    }
  }, [useMovieBoxProForMovies]);

  const toggleMovieBoxProForMovies = () => {
    setUseMovieBoxProForMovies((prev) => !prev);
  };

  useEffect(() => {
    loadSetting();
  }, []);

  useEffect(() => {
    if (!isLoading) {
      saveSetting();
    }
  }, [useMovieBoxProForMovies, isLoading, saveSetting]);

  return {
    useMovieBoxProForMovies,
    isLoading,
    toggleMovieBoxProForMovies,
  };
};
