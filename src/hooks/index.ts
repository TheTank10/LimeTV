// Home = The screen that lists movies and TV shows with search tool 
// Detail = The screen that shows detailed information about a specific movie or TV show
// Settings = The screen where users can configure app preferences
// Shared = Hooks that are used across multiple screens

// Home Screen Hooks
export { useDebounce } from './Home/useDebounce';
export { useScrollAnimation } from './Home/useScrollAnimation';
export { useContentLoader } from './Home/useContentLoader';
export { useSearch } from './Home/useSearch';

// Detail Screen Hooks
export { useContentDetails } from './Detail/useContentDetails';
export { useSeasonData } from './Detail/useSeasonData';
export * from './Detail/useSubtitlePreferences';
export { useShareKey } from './Detail/useShareKey';
export { useStreamFetcher } from './Detail/useStreamFetcher';

// Settings Screen Hooks
export { useFebBoxTokens } from './Settings/useFebboxTokens';
export { useSubtitleLanguages } from './Settings/useSubtitleLanguages';
export { useFebBoxServer } from './Settings/useFebboxServer';
export { useFebBox4K } from './Settings/useFebbox4K';
export { useMovieBoxPro } from './Settings/useMovieBoxPro';

// Shared Hooks 
export { useSubtitleStyling } from './Shared/useSubtitleStyling';
export { useContinueWatching } from './Shared/useContinueWatching';