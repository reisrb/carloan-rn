import AsyncStorage from '@react-native-async-storage/async-storage';

export type BackgroundStyle = 'neutro' | 'suave' | 'solido';

export interface AppPrefs {
  accentHex: string;
  background: BackgroundStyle;
}

const KEY = 'app_prefs';

const DEFAULTS: AppPrefs = {
  accentHex: '#60A5FA',
  background: 'neutro',
};

export const prefsService = {
  async load(): Promise<AppPrefs> {
    try {
      const raw = await AsyncStorage.getItem(KEY);
      if (!raw) return DEFAULTS;
      return { ...DEFAULTS, ...JSON.parse(raw) };
    } catch {
      return DEFAULTS;
    }
  },

  async save(prefs: Partial<AppPrefs>): Promise<void> {
    const current = await prefsService.load();
    await AsyncStorage.setItem(KEY, JSON.stringify({ ...current, ...prefs }));
  },
};

export const PRESET_ACCENTS = [
  { label: 'Azul', hex: '#60A5FA' },
  { label: 'Verde', hex: '#ADFF6C' },
  { label: 'Roxo', hex: '#C084FC' },
  { label: 'Teal', hex: '#2DD4BF' },
  { label: 'Laranja', hex: '#FB923C' },
  { label: 'Vermelho', hex: '#F87171' },
];

export function accentDarkFor(hex: string): string {
  // Darken the accent color by ~30% for text/borders
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const factor = 0.65;
  const dr = Math.round(r * factor);
  const dg = Math.round(g * factor);
  const db = Math.round(b * factor);
  return `#${dr.toString(16).padStart(2, '0')}${dg.toString(16).padStart(2, '0')}${db.toString(16).padStart(2, '0')}`;
}
