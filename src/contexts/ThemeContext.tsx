import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useColorScheme } from 'react-native';
import { AppPrefs, BackgroundStyle, accentDarkFor, prefsService } from '../services/prefsService';

interface ThemeContextValue {
  accentHex: string;
  background: BackgroundStyle;
  setAccent: (hex: string) => void;
  setBackground: (bg: BackgroundStyle) => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  accentHex: '#60A5FA',
  background: 'neutro',
  setAccent: () => {},
  setBackground: () => {},
});

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const scheme = useColorScheme();
  const [prefs, setPrefs] = useState<AppPrefs>({ accentHex: '#60A5FA', background: 'neutro' });

  useEffect(() => {
    prefsService.load().then(setPrefs);
  }, []);

  const setAccent = useCallback((hex: string) => {
    setPrefs(p => ({ ...p, accentHex: hex }));
    prefsService.save({ accentHex: hex });
  }, []);

  const setBackground = useCallback((bg: BackgroundStyle) => {
    setPrefs(p => ({ ...p, background: bg }));
    prefsService.save({ background: bg });
  }, []);

  // scheme in deps forces context consumers to re-render when system theme changes
  const value = useMemo(() => ({
    accentHex: prefs.accentHex,
    background: prefs.background,
    setAccent,
    setBackground,
  }), [prefs, scheme, setAccent, setBackground]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export const useThemePrefs = () => useContext(ThemeContext);

export function useThemedColors() {
  const scheme = useColorScheme();
  const { accentHex, background } = useThemePrefs();
  const dark = scheme === 'dark';

  const accent = accentHex;
  const accentDark = accentDarkFor(accentHex);
  const accentSubtle = accentHex + '26';
  const accentBorder = accentHex + '66';

  let bg: string;
  let card: string;
  if (background === 'solido') {
    bg = dark ? '#000000' : '#FFFFFF';
    card = dark ? '#000000' : '#FFFFFF';
  } else if (background === 'suave') {
    bg = dark ? '#0A0A0F' : '#F8F8FF';
    card = dark ? '#1A1A22' : '#FFFFFF';
  } else {
    bg = dark ? '#000000' : '#F2F2F7';
    card = dark ? '#1C1C1E' : '#FFFFFF';
  }

  return {
    accent,
    accentDark,
    accentSubtle,
    accentBorder,
    bg,
    card,
    text: dark ? '#FFFFFF' : '#111111',
    textSecondary: dark ? '#8E8E93' : '#6B6B72',
    textTertiary: dark ? '#636366' : '#AEAEB2',
    border: dark ? 'rgba(255,255,255,0.09)' : 'rgba(0,0,0,0.07)',
    separator: dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.055)',
    spend: '#FF3B30',
    orange: '#FF9F0A',
    shadow: {
      shadowColor: dark ? '#000' : '#1C1C1E',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: dark ? 0.3 : 0.05,
      shadowRadius: 8,
      elevation: 2,
    },
    shadowMd: {
      shadowColor: dark ? '#000' : '#1C1C1E',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: dark ? 0.4 : 0.08,
      shadowRadius: 16,
      elevation: 5,
    },
    shadowLg: {
      shadowColor: dark ? '#000' : '#1C1C1E',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: dark ? 0.5 : 0.12,
      shadowRadius: 24,
      elevation: 8,
    },
  };
}
