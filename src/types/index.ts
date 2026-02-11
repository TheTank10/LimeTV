import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { TokenValidationResult } from '../services/febbox';

// Movie and TV show data structures
export interface Movie {
  id: number;
  title?: string;
  name?: string;
  poster_path: string;
  backdrop_path: string;
  vote_average: number;
  overview: string;
  media_type?: 'movie' | 'tv';
}

// Category data structure (for horizontal scrolling rows)
export interface Category {
  title: string;
  items: Movie[];
  loading: boolean;
}

// Media type filter options
export type MediaType = 'all' | 'movie' | 'tv';

// Navigation types
export type RootStackParamList = {
  Home: undefined;
  Detail: {
    item: Movie;
  };
  Player: {
    videoUrl: string;
    title: string;
    subtitle?: string;
    subtitles?: {
      title: string;
      language: string;
      uri: string;
    }[];
    tmdbId?: number;
    mediaType?: 'movie' | 'tv';
    season?: number;
    episode?: number;
  };
  Settings: undefined
};

export type DetailScreenProps = NativeStackScreenProps<RootStackParamList, 'Detail'>;
export type HomeScreenProps = NativeStackScreenProps<RootStackParamList, 'Home'>;
export type PlayerScreenProps = NativeStackScreenProps<RootStackParamList, 'Player'>;

// Types for detailed movie/TV data
export interface Genre {
  id: number;
  name: string;
}

export interface ProductionCompany {
  id: number;
  name: string;
  logo_path: string | null;
  origin_country: string;
}

export interface CastMember {
  id: number;
  name: string;
  character: string;
  profile_path: string | null;
  order: number;
}

export interface CrewMember {
  id: number;
  name: string;
  job: string;
  department: string;
  profile_path: string | null;
}

export interface Video {
  id: string;
  key: string;
  name: string;
  site: string;
  type: string;
  official: boolean;
}

export interface Review {
  id: string;
  author: string;
  content: string;
  created_at: string;
  author_details: {
    rating: number | null;
    avatar_path: string | null;
  };
}

export interface Episode {
  id: number;
  name: string;
  overview: string;
  episode_number: number;
  season_number: number;
  still_path: string | null;
  air_date: string;
  vote_average: number;
  runtime: number | null;
}

export interface SeasonDetails {
  id: number;
  name: string;
  overview: string;
  season_number: number;
  poster_path: string | null;
  air_date: string;
  episodes: Episode[];
}

// Detailed Movie Response
export interface MovieDetails {
  id: number;
  title: string;
  original_title: string;
  overview: string;
  tagline: string;
  poster_path: string;
  backdrop_path: string;
  vote_average: number;
  vote_count: number;
  release_date: string;
  runtime: number;
  budget: number;
  revenue: number;
  status: string;
  genres: Genre[];
  production_companies: ProductionCompany[];
  spoken_languages: { iso_639_1: string; name: string }[];
  imdb_id: string | null;
}

// Detailed TV Show Response
export interface TVDetails {
  id: number;
  name: string;
  original_name: string;
  overview: string;
  tagline: string;
  poster_path: string;
  backdrop_path: string;
  vote_average: number;
  vote_count: number;
  first_air_date: string;
  last_air_date: string;
  number_of_seasons: number;
  number_of_episodes: number;
  episode_run_time: number[];
  status: string;
  type: string;
  genres: Genre[];
  networks: { id: number; name: string; logo_path: string | null }[];
  production_companies: ProductionCompany[];
  created_by: { id: number; name: string; profile_path: string | null }[];
  seasons: {
    id: number;
    name: string;
    season_number: number;
    episode_count: number;
    poster_path: string | null;
    air_date: string;
  }[];
}

// Complete detail response
export interface ContentDetails {
  details: MovieDetails | TVDetails;
  credits: {
    cast: CastMember[];
    crew: CrewMember[];
  };
  videos: {
    results: Video[];
  };
  similar: {
    results: any[];
  };
  recommendations: {
    results: any[];
  };
}

// SETTINGS
// Febbox token state
export interface TokenState {
  value: string;
  status: 'idle' | 'validating' | 'valid' | 'invalid';
  data?: TokenValidationResult['data'];
}

export interface SubtitleLanguage {
  code: string; // e.g., 'en', 'es', 'fr'
  name: string; // e.g., 'English', 'Spanish', 'French'
}