import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme, Theme, formatBRL } from '../theme';
import { useResponsive } from '../hooks/useResponsive';
import { FuelFillup, fuelByMonth, fuelMonthlyAverage, fuelConsumptionByFill, fuelConsumptionByFlag, fuelConsumptionByType } from '../types';
import { fuelService } from '../services/fuelService';
import { AddFuelSheet } from '../components/AddFuelSheet';
import { RootStackParamList, TAB_BAR_BOTTOM_OFFSET } from '../navigation';
import { formatDate } from '../utils/date';
import { showConfirm, showAlert } from '../utils/dialogs';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Route = RouteProp<RootStackParamList, 'Fuel'>;
type View2 = 'list' | 'dashboard';

export const FuelScreen: React.FC = () => {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const { contentStyle } = useResponsive();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const { financingId, readOnly, currentKm } = route.params;

  const [items, setItems] = useState<FuelFillup[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<View2>('list');
  const [showSheet, setShowSheet] = useState(false);
  const [editing, setEditing] = useState<FuelFillup | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    fuelService.listByCar(financingId).then(setItems).catch(() => null).finally(() => setLoading(false));
  }, [financingId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const remove = (f: FuelFillup) => {
    showConfirm('Excluir abastecimento?', `${formatBRL(f.totalValue)} será removido.`, 'Excluir', async () => {
      try { await fuelService.remove(f.id); load(); } catch (e: any) { showAlert('Erro', e?.message ?? 'Tente novamente'); }
    });
  };

  const consMap = fuelConsumptionByFill(items);
  const byFlag = fuelConsumptionByFlag(items);
  const byType = fuelConsumptionByType(items);
  const months = fuelByMonth(items);
  const average = fuelMonthlyAverage(items);
  const grandTotal = items.reduce((s, f) => s + f.totalValue, 0);
  const maxMonth = months.reduce((m, x) => Math.max(m, x.total), 0) || 1;

  return (
    <View style={styles.container}>
      <View style={[styles.topBar, { paddingTop: insets.top + 4 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={28} color={theme.accentDark} />
        </TouchableOpacity>
        <Text style={styles.topTitle}>Gasolina</Text>
        <View style={{ width: 36 }} />
      </View>

      <View style={styles.segmentWrap}>
        <View style={styles.segment}>
          <TouchableOpacity style={[styles.segmentBtn, view === 'list' && styles.segmentBtnActive]} onPress={() => setView('list')}>
            <Text style={[styles.segmentText, view === 'list' && styles.segmentTextActive]}>Abastecimentos</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.segmentBtn, view === 'dashboard' && styles.segmentBtnActive]} onPress={() => setView('dashboard')}>
            <Text style={[styles.segmentText, view === 'dashboard' && styles.segmentTextActive]}>Dashboard</Text>
          </TouchableOpacity>
        </View>
      </View>

      {loading ? (
        <View style={[styles.center, { flex: 1 }]}><ActivityIndicator size="large" color={theme.accentDark} /></View>
      ) : (
        <ScrollView contentContainerStyle={[{ paddingBottom: TAB_BAR_BOTTOM_OFFSET + 80 }, contentStyle]}>
          {view === 'list' ? (
            items.length === 0 ? (
              <View style={styles.empty}>
                <Ionicons name="water-outline" size={52} color={theme.textTertiary} />
                <Text style={styles.emptyTitle}>Nenhum abastecimento</Text>
                <Text style={styles.emptySub}>Toque em + para registrar um abastecimento.</Text>
              </View>
            ) : items.map(f => (
              <TouchableOpacity key={f.id} style={styles.row} activeOpacity={0.7} disabled={readOnly} onPress={() => { setEditing(f); setShowSheet(true); }}>
                <View style={styles.rowBody}>
                  <View style={styles.rowTop}>
                    <Text style={styles.rowValue}>{formatBRL(f.totalValue)}</Text>
                    {consMap[f.id] != null && (
                      <Text style={styles.rowConsumption}>{consMap[f.id].toFixed(1)} km/L</Text>
                    )}
                  </View>
                  <Text style={styles.rowMeta}>
                    {[f.flag, f.fuelType, f.local, f.date != null ? formatDate(f.date) : null, f.liters != null ? `${f.liters.toLocaleString('pt-BR', { maximumFractionDigits: 3 })} L` : null, f.kmDriven != null ? `${f.kmDriven.toLocaleString('pt-BR', { maximumFractionDigits: 2 })} km rodados` : null].filter(Boolean).join(' · ') || '—'}
                  </Text>
                </View>
                {!readOnly && (
                  <TouchableOpacity onPress={() => remove(f)} style={styles.removeBtn}>
                    <Ionicons name="close-circle" size={18} color={theme.textSecondary} />
                  </TouchableOpacity>
                )}
              </TouchableOpacity>
            ))
          ) : (
            <>
              <View style={[styles.card, styles.hero]}>
                <Text style={styles.heroLabel}>MÉDIA MENSAL</Text>
                <Text style={styles.heroValue}>{formatBRL(average)}</Text>
                <Text style={styles.heroSub}>{months.length} {months.length === 1 ? 'mês' : 'meses'} · total {formatBRL(grandTotal)}</Text>
              </View>
              {months.length === 0 ? (
                <Text style={styles.emptySub}>Sem dados ainda.</Text>
              ) : (
                <View style={styles.card}>
                  {months.map((m, i) => (
                    <View key={m.key} style={[styles.monthRow, i > 0 && styles.monthRowSep]}>
                      <Text style={styles.monthLabel}>{m.label}</Text>
                      <View style={styles.barTrack}>
                        <View style={[styles.barFill, { width: `${Math.max(6, (m.total / maxMonth) * 100)}%` }]} />
                      </View>
                      <Text style={styles.monthValue}>{formatBRL(m.total)}</Text>
                    </View>
                  ))}
                </View>
              )}

              {byType.length > 0 && (
                <>
                  <Text style={styles.flagTitle}>Consumo por combustível</Text>
                  <View style={styles.card}>
                    {byType.map((b, i) => (
                      <View key={b.type} style={[styles.monthRow, i > 0 && styles.monthRowSep]}>
                        {i === 0 && <Ionicons name="trophy" size={14} color={theme.orange} style={{ marginRight: 4 }} />}
                        <Text style={styles.flagLabel} numberOfLines={1}>{b.type}</Text>
                        <Text style={styles.flagValue}>{b.kmL.toFixed(1)} km/L</Text>
                      </View>
                    ))}
                  </View>
                </>
              )}

              {byFlag.length > 0 && (
                <>
                  <Text style={styles.flagTitle}>Consumo por bandeira</Text>
                  <View style={styles.card}>
                    {byFlag.map((b, i) => (
                      <View key={b.flag} style={[styles.monthRow, i > 0 && styles.monthRowSep]}>
                        {i === 0 && <Ionicons name="trophy" size={14} color={theme.orange} style={{ marginRight: 4 }} />}
                        <Text style={styles.flagLabel} numberOfLines={1}>{b.flag}</Text>
                        <Text style={styles.flagValue}>{b.kmL.toFixed(1)} km/L</Text>
                      </View>
                    ))}
                  </View>
                </>
              )}
            </>
          )}
        </ScrollView>
      )}

      {!readOnly && view === 'list' && (
        <TouchableOpacity style={[styles.fab, { bottom: TAB_BAR_BOTTOM_OFFSET + 16 }]} onPress={() => { setEditing(null); setShowSheet(true); }} activeOpacity={0.85}>
          <Ionicons name="add" size={30} color="#000" />
        </TouchableOpacity>
      )}

      <AddFuelSheet visible={showSheet} financingId={financingId} existing={editing} onClose={() => { setShowSheet(false); setEditing(null); }} onSaved={() => { setShowSheet(false); setEditing(null); load(); }} />
    </View>
  );
};

const makeStyles = (theme: Theme) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.bg },
  center: { alignItems: 'center', justifyContent: 'center' },
  topBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingBottom: 10, backgroundColor: theme.bg, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: theme.border },
  backBtn: { padding: 4 },
  topTitle: { flex: 1, fontSize: 20, fontWeight: '800', color: theme.text, textAlign: 'center' },
  segmentWrap: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4 },
  segment: { flexDirection: 'row', backgroundColor: theme.separator, borderRadius: 12, padding: 3 },
  segmentBtn: { flex: 1, paddingVertical: 9, borderRadius: 9, alignItems: 'center' },
  segmentBtnActive: { backgroundColor: theme.card, ...theme.shadow },
  segmentText: { fontSize: 14, fontWeight: '600', color: theme.textSecondary },
  segmentTextActive: { color: theme.text, fontWeight: '800' },
  empty: { alignItems: 'center', gap: 10, marginTop: 70, paddingHorizontal: 40 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: theme.text },
  emptySub: { fontSize: 14, color: theme.textSecondary, textAlign: 'center', lineHeight: 20, marginHorizontal: 20, marginTop: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, marginHorizontal: 16, marginTop: 10, backgroundColor: theme.card, borderRadius: 14, padding: 14, ...theme.shadow },
  rowBody: { flex: 1, gap: 2 },
  rowTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  rowValue: { fontSize: 16, fontWeight: '800', color: theme.text },
  rowConsumption: { fontSize: 13, fontWeight: '700', color: theme.accentDark },
  rowMeta: { fontSize: 13, color: theme.textSecondary },
  removeBtn: { padding: 2 },
  card: { marginHorizontal: 16, marginTop: 12, backgroundColor: theme.card, borderRadius: 16, padding: 16, ...theme.shadow },
  hero: { alignItems: 'center', gap: 4, paddingVertical: 24 },
  heroLabel: { fontSize: 12, fontWeight: '800', letterSpacing: 0.6, color: theme.accentDark },
  heroValue: { fontSize: 34, fontWeight: '900', color: theme.text },
  heroSub: { fontSize: 13, color: theme.textSecondary },
  monthRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10 },
  monthRowSep: { borderTopWidth: StyleSheet.hairlineWidth, borderColor: theme.separator },
  monthLabel: { fontSize: 13, fontWeight: '600', color: theme.text, width: 84, textTransform: 'capitalize' },
  barTrack: { flex: 1, height: 8, borderRadius: 4, backgroundColor: theme.separator, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 4, backgroundColor: theme.accentDark },
  monthValue: { fontSize: 13, fontWeight: '700', color: theme.text, width: 88, textAlign: 'right' },
  flagTitle: { fontSize: 12, fontWeight: '700', color: theme.textSecondary, marginHorizontal: 20, marginTop: 18, marginBottom: 8, letterSpacing: 0.5, textTransform: 'uppercase' },
  flagLabel: { flex: 1, fontSize: 14, fontWeight: '600', color: theme.text },
  flagValue: { fontSize: 14, fontWeight: '800', color: theme.accentDark },
  fab: { position: 'absolute', right: 20, width: 58, height: 58, borderRadius: 29, backgroundColor: theme.accent, alignItems: 'center', justifyContent: 'center', ...theme.shadowLg },
});
