// Color palette
export const COLORS = {
  background: '#000000',
  backgroundGradient: ['#000000', '#050505', '#000000', '#000000'] as const,
  text: '#FFFFFF',
  textMuted: '#999',
  textDark: '#666',
  border: 'rgba(255, 255, 255, 0.2)',
  borderLight: 'rgba(255, 255, 255, 0.25)',
  overlay: 'rgba(255, 255, 255, 0.1)',
  overlayStrong: 'rgba(255, 255, 255, 0.2)',
  shimmer: 'rgba(255, 255, 255, 0.08)',
  buttonLight: 'rgba(255, 255, 255, 0.9)',
  buttonDark: '#000',
  primary: '#FF6B6B',
};

// Spacing system
export const SPACING = {
  xs: 5,
  sm: 10,
  md: 15,
  lg: 20,
  xl: 30,
  xxl: 50,
};

// Font sizes
export const FONT_SIZES = {
  xs: 10,
  sm: 12,
  md: 14,
  lg: 16,
  xl: 18,
  xxl: 28,
};

// Border radius
export const BORDER_RADIUS = {
  sm: 8,
  md: 10,
  lg: 12,
  xl: 16,
};

// Shadows
export const SHADOWS = {
  glow: {
    shadowColor: '#ffffff',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 10,
  },
  textGlow: {
    textShadowColor: 'rgba(255, 255, 255, 0.9)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 20,
  },
  textGlowStrong: {
    textShadowColor: 'rgba(255, 255, 255, 0.8)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 15,
  },
};