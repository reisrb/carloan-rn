import React, { useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, Theme } from '../theme';
import { useResponsive } from '../hooks/useResponsive';
import { useThemePrefs } from '../contexts/ThemeContext';
import { PRESET_ACCENTS, BackgroundStyle } from '../services/prefsService';
import { TAB_BAR_BOTTOM_OFFSET } from '../navigation';

const BACKGROUNDS: { key: BackgroundStyle; label: string; desc: string }[] = [
  { key: 'neutro', label: 'Neutro', desc: 'Fundo padrão do sistema' },
  { key: 'suave', label: 'Suave', desc: 'Fundo levemente colorido' },
  { key: 'solido', label: 'Sólido', desc: 'Fundo branco/preto puro' },
];

export const AppearanceScreen: React.FC = () => {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const { contentStyle } = useResponsive();
  const { accentHex, background, setAccent, setBackground } = useThemePrefs();
  const [customHex, setCustomHex] = useState(accentHex);
  const [hexError, setHexError] = useState(false);

  const applyCustom = () => {
    const hex = customHex.startsWith('#') ? customHex : '#' + customHex;
    if (/^#[0-9A-Fa-f]{6}$/.test(hex)) {
      setAccent(hex);
      setHexError(false);
    } else {
      setHexError(true);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={[{ paddingBottom: TAB_BAR_BOTTOM_OFFSET + 20 }, contentStyle]}>
      <Text style={styles.sectionHeader}>COR DE DESTAQUE</Text>
      <View style={styles.swatchGrid}>
        {PRESET_ACCENTS.map(p => (
          <TouchableOpacity
            key={p.hex}
            style={[styles.swatch, { backgroundColor: p.hex }, accentHex === p.hex && styles.swatchSelected]}
            onPress={() => { setAccent(p.hex); setCustomHex(p.hex); }}
          >
            {accentHex === p.hex && <Ionicons name="checkmark" size={18} color="#000" />}
          </TouchableOpacity>
        ))}
      </View>
      <View style={styles.card}>
        <View style={styles.hexRow}>
          <View style={[styles.hexPreview, { backgroundColor: accentHex }]} />
          <TextInput
            style={[styles.hexInput, hexError && { borderColor: theme.spend }]}
            value={customHex}
            onChangeText={v => { setCustomHex(v); setHexError(false); }}
            placeholder="#RRGGBB"
            placeholderTextColor={theme.textSecondary}
            autoCapitalize="none"
            autoCorrect={false}
            maxLength={7}
            onSubmitEditing={applyCustom}
          />
          <TouchableOpacity style={[styles.applyBtn, { backgroundColor: theme.accentSubtle }]} onPress={applyCustom}>
            <Text style={[styles.applyBtnText, { color: theme.accentDark }]}>Aplicar</Text>
          </TouchableOpacity>
        </View>
        {hexError && <Text style={styles.hexError}>Hex inválido. Ex: #FF9900</Text>}
      </View>

      <Text style={styles.sectionHeader}>FUNDO</Text>
      <View style={styles.card}>
        {BACKGROUNDS.map((b, idx) => (
          <View key={b.key}>
            {idx > 0 && <View style={styles.sep} />}
            <TouchableOpacity style={styles.bgRow} onPress={() => setBackground(b.key)}>
              <View style={{ flex: 1 }}>
                <Text style={styles.bgLabel}>{b.label}</Text>
                <Text style={styles.bgDesc}>{b.desc}</Text>
              </View>
              {background === b.key && <Ionicons name="checkmark-circle" size={22} color={theme.accentDark} />}
            </TouchableOpacity>
          </View>
        ))}
      </View>

      <Text style={styles.sectionHeader}>PRÉVIA</Text>
      <View style={[styles.previewCard, { backgroundColor: theme.accentSubtle, borderColor: theme.accentBorder }]}>
        <View style={[styles.previewBtn, { backgroundColor: theme.accent }]}>
          <Text style={styles.previewBtnText}>Botão primário</Text>
        </View>
        <Text style={[styles.previewAccent, { color: theme.accentDark }]}>Cor de destaque</Text>
        <Text style={[styles.previewSub, { color: theme.textSecondary }]}>Texto secundário</Text>
      </View>
    </ScrollView>
  );
};

const makeStyles = (theme: Theme) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.bg },
  sectionHeader: { fontSize: 12, fontWeight: '700', color: theme.textSecondary, marginHorizontal: 16, marginTop: 20, marginBottom: 8, letterSpacing: 0.5 },
  card: { marginHorizontal: 16, backgroundColor: theme.card, borderRadius: 16, overflow: 'hidden' },
  sep: { height: StyleSheet.hairlineWidth, backgroundColor: theme.separator, marginHorizontal: 16 },
  swatchGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, paddingHorizontal: 16, marginBottom: 12 },
  swatch: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  swatchSelected: { borderWidth: 3, borderColor: theme.text + '60' },
  hexRow: { flexDirection: 'row', alignItems: 'center', padding: 12, gap: 10 },
  hexPreview: { width: 36, height: 36, borderRadius: 18 },
  hexInput: { flex: 1, fontSize: 15, color: theme.text, borderWidth: 1, borderColor: theme.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 },
  applyBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10 },
  applyBtnText: { fontSize: 14, fontWeight: '700' },
  hexError: { fontSize: 12, color: theme.spend, paddingHorizontal: 14, paddingBottom: 10 },
  bgRow: { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 12 },
  bgLabel: { fontSize: 15, fontWeight: '600', color: theme.text },
  bgDesc: { fontSize: 12, color: theme.textSecondary },
  previewCard: { margin: 16, padding: 20, borderRadius: 16, borderWidth: 1.5, gap: 12, alignItems: 'flex-start' },
  previewBtn: { paddingHorizontal: 20, paddingVertical: 12, borderRadius: 12 },
  previewBtnText: { fontSize: 15, fontWeight: '800', color: '#000' },
  previewAccent: { fontSize: 16, fontWeight: '700' },
  previewSub: { fontSize: 13 },
});
