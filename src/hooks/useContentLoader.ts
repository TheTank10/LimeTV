import { useState, useEffect } from 'react';
import { fetchContent, fetchLazyCategories } from '../services/tmdb';
import { Movie, Category, MediaType } from '../types';

export const useContentLoader = (mediaType: MediaType) => {
  const [heroItem, setHeroItem] = useState<Movie | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [heroLoading, setHeroLoading] = useState(true);

  useEffect(() => {
    loadContent();
  }, [mediaType]);

  const loadContent = async () => {
    setHeroLoading(true);
    setHeroItem(null);
    setCategories([]);

    try {
      // Load priority content first
      const { heroItem: newHero, categories: newCategories } = await fetchContent(mediaType);

      setHeroItem(newHero);
      setCategories(newCategories);
      setHeroLoading(false);

      // Load lazy categories after a short delay (1 second)
      setTimeout(async () => {
        const lazyCategories = await fetchLazyCategories(mediaType);
        
        // Replace loading placeholders with actual data
        setCategories((prev) => {
          const priorityCount = prev.filter(cat => !cat.loading).length;
          return [...prev.slice(0, priorityCount), ...lazyCategories];
        });
      }, 1000);

    } catch (error) {
      console.error('Failed to load content:', error);
      setHeroLoading(false);
    }
  };

  return {
    heroItem,
    categories,
    heroLoading,
    reload: loadContent,
  };
};