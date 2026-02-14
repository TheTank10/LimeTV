import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { TMDB_BASE_URL, ITEMS_PER_CATEGORY, TMDB_API_KEY } from '../constants/config';
import { getEndpoints } from '../constants/endpoints';
import { Movie, Category, MediaType } from '../types';
import { ContentDetails, MovieDetails, TVDetails, SeasonDetails } from '../types';

const MY_LIST_KEY = '@limetv_my_list';
const CONTINUE_WATCHING_KEY = '@continue_watching';

// Create axios instance with Bearer token authentication
const tmdbClient = axios.create({
  baseURL: TMDB_BASE_URL,
  headers: {
    'Authorization': `Bearer ${TMDB_API_KEY}`,
    'Content-Type': 'application/json;charset=utf-8',
  },
});

// Helper to filter out invalid items (no poster, no backdrop, people, etc.)
const filterValidItems = (items: any[]): Movie[] => {
  return items
    .filter((item: any) =>
      item.poster_path &&
      item.backdrop_path &&
      (item.media_type === 'movie' || item.media_type === 'tv' || item.title || item.name)
    )
    .slice(0, ITEMS_PER_CATEGORY);
};

// Helper to find best hero item (good backdrop + high rating)
const findBestHeroItem = (items: any[]): Movie | null => {
  // First try: find high-rated item with good images
  const validHero = items.find((item: any) =>
    item.backdrop_path &&
    item.poster_path &&
    item.vote_average > 6 &&
    (item.media_type === 'movie' || item.media_type === 'tv' || item.title || item.name)
  );

  // Fallback: any item with backdrop
  const fallbackHero = items.find((item: any) =>
    item.backdrop_path && item.poster_path
  );

  return validHero || fallbackHero || items[0] || null;
};

/**
 * Fetch My List items from AsyncStorage
 */
const fetchMyList = async (): Promise<Movie[]> => {
  try {
    const myListJson = await AsyncStorage.getItem(MY_LIST_KEY);
    if (!myListJson) return [];
    
    const savedIds: number[] = JSON.parse(myListJson);
    if (savedIds.length === 0) return [];
    
    // Fetch details for each saved item
    const itemPromises = savedIds.map(async (id) => {
      try {
        // Try movie first
        const movieRes = await tmdbClient.get(`/movie/${id}`);
        if (movieRes.data) {
          return { ...movieRes.data, media_type: 'movie' };
        }
      } catch {
        // If movie fails, try TV
        try {
          const tvRes = await tmdbClient.get(`/tv/${id}`);
          if (tvRes.data) {
            return { 
              ...tvRes.data, 
              title: tvRes.data.name,
              media_type: 'tv' 
            };
          }
        } catch {
          return null;
        }
      }
      return null;
    });
    
    const items = await Promise.all(itemPromises);
    return items.filter((item): item is Movie => item !== null);
  } catch (error) {
    console.error('Error loading My List:', error);
    return [];
  }
};

/**
 * Fetch Continue Watching items from AsyncStorage
 * Returns Movie[] with progress metadata attached
 */
export const fetchContinueWatching = async (): Promise<Movie[]> => {
  try {
    const continueWatchingJson = await AsyncStorage.getItem(CONTINUE_WATCHING_KEY);
    if (!continueWatchingJson) return [];
    
    const savedItems: Array<{
      tmdbId: number;
      mediaType: 'movie' | 'tv';
      timestamp: number;
      duration: number;
      season?: number;
      episode?: number;
      lastWatched: number;
    }> = JSON.parse(continueWatchingJson);
    
    if (savedItems.length === 0) return [];
    
    // Fetch TMDB details for each continue watching item
    const itemPromises = savedItems.map(async (item) => {
      try {
        const endpoint = item.mediaType === 'movie' 
          ? `/movie/${item.tmdbId}` 
          : `/tv/${item.tmdbId}`;
        
        const response = await tmdbClient.get(endpoint);
        
        if (response.data) {
          return {
            ...response.data,
            media_type: item.mediaType,
            title: response.data.title || response.data.name,
            // Attach progress metadata for UI
            continueWatching: {
              timestamp: item.timestamp,
              duration: item.duration,
              progress: (item.timestamp / item.duration) * 100,
              season: item.season,
              episode: item.episode,
            },
          };
        }
      } catch (error) {
        console.error(`Failed to fetch TMDB data for ${item.tmdbId}:`, error);
        return null;
      }
      return null;
    });
    
    const items = await Promise.all(itemPromises);
    return items.filter((item): item is Movie => item !== null);
  } catch (error) {
    console.error('Error loading Continue Watching:', error);
    return [];
  }
};

/**
 * Fetch all content for a given media type (all, movie, tv)
 * Returns hero item and categories in parallel for best performance
 */
export const fetchContent = async (type: MediaType) => {
  const config = getEndpoints(type);

  try {
    const [heroResponse, myListItems, continueWatchingItems, ...categoryResponses] = await Promise.all([
      tmdbClient.get(config.hero),
      fetchMyList(),
      fetchContinueWatching(),
      ...config.priority.map(async (endpoint, index) => {
        const response = await tmdbClient.get(endpoint.url);
        return response;
      }),
    ]);

    const heroItem = findBestHeroItem(heroResponse.data.results);
    
    const priorityCategories: Category[] = config.priority.map((endpoint, i) => ({
      title: endpoint.title,
      items: filterValidItems(categoryResponses[i].data.results),
      loading: false,
    }));

    // Build categories with Continue Watching first (if items exist), then My List, then rest
    const categoriesWithSpecialSections: Category[] = [];
    
    // Add first priority category (usually Trending)
    if (priorityCategories.length > 0) {
      categoriesWithSpecialSections.push(priorityCategories[0]);
    }
    
    // Add Continue Watching (only on 'all' tab and if items exist)
    if (continueWatchingItems.length > 0 && type === 'all') {
      categoriesWithSpecialSections.push({
        title: 'Continue Watching',
        items: continueWatchingItems,
        loading: false,
      });
    }
    
    // Add My List (only on 'all' tab and if items exist)
    if (myListItems.length > 0 && type === 'all') {
      categoriesWithSpecialSections.push({
        title: 'My List',
        items: myListItems,
        loading: false,
      });
    }
    
    // Add rest of priority categories
    categoriesWithSpecialSections.push(...priorityCategories.slice(1));

    // Add lazy category placeholders
    const lazyPlaceholders: Category[] = config.lazy.map((endpoint) => ({
      title: endpoint.title,
      items: [],
      loading: true,  // Mark as loading
    }));

    return {
      heroItem,
      categories: [...categoriesWithSpecialSections, ...lazyPlaceholders],
    };
  } catch (error: unknown) {
    console.error('❌ ERROR LOADING CONTENT:');
    if (axios.isAxiosError(error)) {
      console.error('Axios error details:');
      console.error('  Status:', error.response?.status);
      console.error('  Response data:', JSON.stringify(error.response?.data, null, 2));
    }
    throw error;
  }
};

/**
 * Fetch lazy-loaded categories
 */
export const fetchLazyCategories = async (type: MediaType): Promise<Category[]> => {
  const config = getEndpoints(type);

  try {
    const responses = await Promise.all(
      config.lazy.map(async (endpoint, index) => {
        const response = await tmdbClient.get(endpoint.url);
        return response;
      })
    );

    const lazyCategories: Category[] = config.lazy.map((endpoint, i) => ({
      title: endpoint.title,
      items: filterValidItems(responses[i].data.results),
      loading: false,
    }));

    return lazyCategories;
  } catch (error) {
    console.error('ERROR LOADING LAZY CATEGORIES:', error);
    return [];
  }
};

/**
 * Search for movies and TV shows
 */
export const searchContent = async (query: string): Promise<Movie[]> => {
  if (!query.trim()) {
    return [];
  }

  try {
    const response = await tmdbClient.get('/search/multi', {
      params: { query: encodeURIComponent(query) },
    });

    // Filter to only movies and TV shows
    const filtered = response.data.results.filter(
      (item: any) => item.media_type === 'movie' || item.media_type === 'tv'
    );

    return filtered;
  } catch (error: unknown) {
    console.error('SEARCH ERROR:');

    if (axios.isAxiosError(error)) {
      console.error('  Status:', error.response?.status);
      console.error('  Response data:', JSON.stringify(error.response?.data, null, 2));
    } else {
      console.error('Error:', error instanceof Error ? error.message : String(error));
    }

    return [];
  }
};

/**
 * Fetch detailed information for a movie or TV show
 * Fetches: details, credits, videos, similar, and recommendations in parallel
 */
export const fetchContentDetails = async (
  id: number,
  mediaType: 'movie' | 'tv'
): Promise<ContentDetails> => {
  const baseUrl = `/${mediaType}/${id}`;

  try {
    const [detailsRes, creditsRes, videosRes, similarRes, recommendationsRes] = await Promise.all([
      tmdbClient.get(baseUrl),
      tmdbClient.get(`${baseUrl}/credits`),
      tmdbClient.get(`${baseUrl}/videos`),
      tmdbClient.get(`${baseUrl}/similar`),
      tmdbClient.get(`${baseUrl}/recommendations`),
    ]);

    return {
      details: detailsRes.data,
      credits: creditsRes.data,
      videos: videosRes.data,
      similar: similarRes.data,
      recommendations: recommendationsRes.data,
    };
  } catch (error: unknown) {
    console.error('ERROR LOADING DETAILS:');
    if (axios.isAxiosError(error)) {
      console.error('  Status:', error.response?.status);
      console.error('  Response data:', JSON.stringify(error.response?.data, null, 2));
    }
    throw error;
  }
};

/**
 * Fetch detailed information for a specific season of a TV show
 */
export const fetchSeasonDetails = async (
  tvId: number,
  seasonNumber: number
): Promise<SeasonDetails> => {
  try {
    const response = await tmdbClient.get(`/tv/${tvId}/season/${seasonNumber}`);
    return response.data;
  } catch (error: unknown) {
    console.error('ERROR LOADING SEASON:');
    if (axios.isAxiosError(error)) {
      console.error('  Status:', error.response?.status);
      console.error('  Response data:', JSON.stringify(error.response?.data, null, 2));
    }
    throw error;
  }
};

export const getImdbId = async (
  id: number,
  mediaType: 'movie' | 'tv'
): Promise<string | null> => {
  try {
    const response = await tmdbClient.get(`/${mediaType}/${id}/external_ids`);
    return response.data.imdb_id || null;
  } catch (error: unknown) {
    console.error('ERROR GETTING IMDB ID:');
    if (axios.isAxiosError(error)) {
      console.error('  Status:', error.response?.status);
      console.error('  Response data:', JSON.stringify(error.response?.data, null, 2));
    }
    return null;
  }
};