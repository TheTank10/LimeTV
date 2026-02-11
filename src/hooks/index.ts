// Home = The screen that lists movies and TV shows with search tool 
// Detail = The screen that shows detailed information about a specific movie or TV show

// Home Screen Hooks
export { useDebounce } from './useDebounce';
export { useScrollAnimation } from './useScrollAnimation';
export { useContentLoader } from './useContentLoader';
export { useSearch } from './useSearch';

// Detail Screen Hooks
export { useContentDetails } from './useContentDetails';
export { useSeasonData } from './useSeasonData';
export * from './useSubtitlePreferences';

// Settings Screen Hooks
export * from './useFebboxTokens';
export * from './useSubtitleLanguages';