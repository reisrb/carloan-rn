import { useMemo } from 'react';
import { useColorScheme } from 'react-native';

// Re-export context hook so existing components importing useTheme keep working
export { useThemedColors as useTheme } from './contexts/ThemeContext';

const lightColors = {
  bg: '#F2F2F7',
  card: '#FFFFFF',
  text: '#111111',
  textSecondary: '#6B6B72',
  textTertiary: '#AEAEB2',
  border: 'rgba(0,0,0,0.07)',
  separator: 'rgba(0,0,0,0.055)',
};

const shared = {
  accent: '#60A5FA',
  accentDark: '#3E6BA3',
  accentSubtle: 'rgba(96,165,250,0.15)',
  accentBorder: 'rgba(96,165,250,0.4)',
  spend: '#FF3B30',
  orange: '#FF9F0A',
  shadow: {
    shadowColor: '#1C1C1E',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  shadowMd: {
    shadowColor: '#1C1C1E',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 5,
  },
  shadowLg: {
    shadowColor: '#1C1C1E',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 8,
  },
};

export type Theme = typeof shared & typeof lightColors;

// Static fallback (used in CurrencyInput and other non-hook contexts)
export const theme: Theme = { ...shared, ...lightColors };

export const formatBRL = (value: number): string =>
  value.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

export const generateId = (): string =>
  Date.now().toString(36) + Math.random().toString(36).slice(2);
