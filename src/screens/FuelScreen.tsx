import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme, Theme, formatBRL } from '../theme';
import { useResponsive } from '../hooks/useResponsive';
import { FuelFillup, fuelByMonth, fuelMonthlyAverage } from '../types';
import { fuelService } from '../services/fuelService';
import { fuelCalculator } from '../services/fuelCalculator';
import { AddFuelSheet } from '../components/AddFuelSheet';
import { RootStackParamList, TAB_BAR_BOTTOM_OFFSET } from '../navigation';
import { formatDate } from '../utils/date';
import { showConfirm, showAlert } from '../utils/dialogs';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Route = RouteProp<RootStackParamList, 'Fuel'>;
type View2 = 'list' | 'dashboard';

const TREND_META: Record<'up' | 'down' | 'stable', { label: string; good: boolean }> = {
  up: { label: 'Melhorando', good: true },
  down: { label: 'Piorando', good: false },
  stable: { label: 'Estável', good: true },
};

export const FuelScreen: React.FC = () => {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const { contentStyle } = useResponsive();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const { financingId, readOnly } = route.params;

  const [items, setItems] = useState<FuelFillup[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<View2>('list');
  const [showSheet, setShowSheet] = useState(false);
  const [editing, setEditing] = useState<FuelFillup | null>(null);
  const [showInfo, setShowInfo] = useState(false);

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

  const stats = useMemo(() => fuelCalculator.tripStats(items), [items]);
  const statsMap = useMemo(() => fuelCalculator.statsByEntry(items), [items]);
  const byFlag = useMemo(() => fuelCalculator.bestByFlag(items), [items]);
  const lastOdometer = items.length > 0
    ? Math.max(...items.map(f => f.km ?? 0))
    : null;
  const latestSegment = stats.allSegments[0];
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
        <TouchableOpacity onPress={() => setShowInfo(true)} style={styles.backBtn}>
          <Ionicons name="information-circle-outline" size={24} color={theme.accentDark} />
        </TouchableOpacity>
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
            ) : items.map((f, idx) => (
              <TouchableOpacity key={f.id} style={styles.row} activeOpacity={0.7} disabled={readOnly} onPress={() => { setEditing(f); setShowSheet(true); }}>
                <View style={styles.rowBody}>
                  <View style={styles.rowTop}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Text style={styles.rowValue}>{formatBRL(f.totalValue)}</Text>
                      {f.fullTank && (
                        <View style={styles.badge}><Text style={styles.badgeText}>Tanque cheio</Text></View>
                      )}
                    </View>
                    {statsMap[f.id] ? (
                      <View style={{ alignItems: 'flex-end' }}>
                        {statsMap[f.id].kmL > 0 && <Text style={styles.rowConsumption}>{statsMap[f.id].kmL.toFixed(1)} km/L</Text>}
                        {statsMap[f.id].costPerKm > 0 && <Text style={styles.rowCost}>{formatBRL(statsMap[f.id].costPerKm)}/km</Text>}
                      </View>
                    ) : idx === 0 ? (
                      <Text style={styles.rowPending}>A definir</Text>
                    ) : null}
                  </View>
                  <Text style={styles.rowMeta}>
                    {[f.flag, f.fuelType, f.local, f.date != null ? formatDate(f.date) : null, f.liters != null ? `${f.liters.toLocaleString('pt-BR', { maximumFractionDigits: 3 })} L` : null, f.km != null ? `${f.km.toLocaleString('pt-BR')} km` : null].filter(Boolean).join(' · ') || '—'}
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
              {stats.firstEntryIsReference && (
                <View style={[styles.card, styles.infoCard]}>
                  <Ionicons name="flag-outline" size={26} color={theme.accentDark} />
                  <Text style={styles.infoTitle}>Ponto de referência</Text>
                  <Text style={styles.infoText}>Primeiro abastecimento registrado. A média aparecerá após o próximo tanque cheio.</Text>
                </View>
              )}

              {stats.pendingEntry && (
                <View style={[styles.card, styles.infoCard]}>
                  <Ionicons name="time-outline" size={26} color={theme.orange} />
                  <Text style={styles.infoTitle}>Aguardando tanque cheio</Text>
                  <Text style={styles.infoText}>
                    {(stats.pendingEntry.liters ?? 0) > 0 ? `${(stats.pendingEntry.liters as number).toLocaleString('pt-BR', { maximumFractionDigits: 3 })} L acumulados` : 'Abastecimento parcial registrado'} — a média será calculada no próximo tanque cheio.
                  </Text>
                </View>
              )}

              {latestSegment && latestSegment.average > 0 && (
                <View style={[styles.card, styles.hero]}>
                  <Text style={styles.heroLabel}>ÚLTIMA MÉDIA{latestSegment.fuelType !== fuelCalculator.NO_TYPE ? ` · ${latestSegment.fuelType.toUpperCase()}` : ''}</Text>
                  <Text style={styles.heroValue}>{latestSegment.average.toFixed(1)} km/L</Text>
                  <Text style={styles.heroSub}>
                    {latestSegment.kmDriven.toLocaleString('pt-BR')} km · {latestSegment.litersTotal.toLocaleString('pt-BR', { maximumFractionDigits: 3 })} L
                    {latestSegment.costPerKm > 0 ? ` · ${formatBRL(latestSegment.costPerKm)}/km` : ''}
                  </Text>
                </View>
              )}

              {latestSegment?.isOutlier && (
                <View style={[styles.card, styles.outlierCard]}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <Ionicons name="warning-outline" size={18} color={theme.orange} />
                    <Text style={styles.infoTitle}>Média fora do padrão</Text>
                  </View>
                  <Text style={styles.infoText}>
                    {latestSegment.outlierDeviationPct !== null
                      ? `Este abastecimento teve uma média ${Math.round(Math.abs(latestSegment.outlierDeviationPct) * 100)}% ${latestSegment.outlierDeviationPct > 0 ? 'maior' : 'menor'} que o habitual. `
                      : ''}
                    Pode ser um erro de digitação ou um abastecimento que não completou o tanque de fato.
                  </Text>
                </View>
              )}

              {stats.byFuelType.length > 0 && (
                <>
                  <Text style={styles.flagTitle}>Consumo por combustível</Text>
                  <View style={styles.card}>
                    {stats.byFuelType.map((t, i) => (
                      <View key={t.fuelType} style={[styles.monthRow, i > 0 && styles.monthRowSep]}>
                        {i === 0 && <Ionicons name="trophy" size={14} color={theme.orange} style={{ marginRight: 4 }} />}
                        <Text style={styles.flagLabel} numberOfLines={1}>{t.fuelType}</Text>
                        <View style={{ alignItems: 'flex-end' }}>
                          {t.overallAverage != null && <Text style={styles.flagValue}>{t.overallAverage.toFixed(1)} km/L</Text>}
                          {t.trend && <Text style={[styles.trendText, { color: TREND_META[t.trend].good ? '#22C55E' : theme.spend }]}>{TREND_META[t.trend].label}</Text>}
                        </View>
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

              <Text style={styles.flagTitle}>Gasto mensal</Text>
              {months.length === 0 ? (
                <Text style={styles.emptySub}>Sem dados ainda.</Text>
              ) : (
                <View style={styles.card}>
                  <View style={styles.monthRow}>
                    <Text style={styles.monthLabel}>Média/mês</Text>
                    <Text style={[styles.monthValue, { width: undefined, flex: 1, textAlign: 'left' }]}>{formatBRL(average)}</Text>
                  </View>
                  {months.map((m, i) => (
                    <View key={m.key} style={[styles.monthRow, styles.monthRowSep]}>
                      <Text style={styles.monthLabel}>{m.label}</Text>
                      <View style={styles.barTrack}>
                        <View style={[styles.barFill, { width: `${Math.max(6, (m.total / maxMonth) * 100)}%` }]} />
                      </View>
                      <Text style={styles.monthValue}>{formatBRL(m.total)}</Text>
                    </View>
                  ))}
                  <View style={[styles.monthRow, styles.monthRowSep]}>
                    <Text style={styles.monthLabel}>Total</Text>
                    <Text style={[styles.monthValue, { width: undefined, flex: 1, textAlign: 'right' }]}>{formatBRL(grandTotal)}</Text>
                  </View>
                </View>
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

      <AddFuelSheet
        visible={showSheet}
        financingId={financingId}
        existing={editing}
        lastOdometer={lastOdometer}
        onClose={() => { setShowSheet(false); setEditing(null); }}
        onSaved={() => { setShowSheet(false); setEditing(null); load(); }}
      />

      <Modal visible={showInfo} transparent animationType="fade" onRequestClose={() => setShowInfo(false)}>
        <View style={styles.infoOverlay}>
          <View style={styles.infoModal}>
            <View style={styles.infoModalHeader}>
              <Ionicons name="information-circle" size={22} color={theme.accentDark} />
              <Text style={styles.infoModalTitle}>Como funciona a média</Text>
            </View>
            <Text style={styles.infoModalText}>
              A média (km/L) é calculada por <Text style={styles.infoModalBold}>tanque cheio</Text>: some os km rodados e os litros abastecidos desde o último tanque cheio até o próximo.
            </Text>
            <Text style={styles.infoModalText}>
              Abastecimentos <Text style={styles.infoModalBold}>parciais</Text> (não marcados como tanque cheio) não geram média sozinhos — eles só acumulam km e litros até você completar o tanque de novo.
            </Text>
            <Text style={styles.infoModalText}>
              O <Text style={styles.infoModalBold}>primeiro abastecimento</Text> registrado não tem uma média anterior pra comparar, então serve só como ponto de partida.
            </Text>
            <Text style={styles.infoModalText}>
              Médias muito fora do padrão (30% acima ou abaixo do habitual) são marcadas como possível erro de digitação.
            </Text>
            <TouchableOpacity style={styles.infoModalBtn} onPress={() => setShowInfo(false)}>
              <Text style={styles.infoModalBtnText}>Entendi</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
  badge: { backgroundColor: theme.accentSubtle, borderRadius: 8, paddingHorizontal: 7, paddingVertical: 2 },
  badgeText: { fontSize: 10, fontWeight: '700', color: theme.accentDark },
  rowConsumption: { fontSize: 13, fontWeight: '700', color: theme.accentDark },
  rowCost: { fontSize: 12, fontWeight: '600', color: theme.textSecondary },
  rowPending: { fontSize: 12, fontWeight: '700', color: theme.textTertiary, fontStyle: 'italic' },
  rowMeta: { fontSize: 13, color: theme.textSecondary },
  removeBtn: { padding: 2 },
  card: { marginHorizontal: 16, marginTop: 12, backgroundColor: theme.card, borderRadius: 16, padding: 16, ...theme.shadow },
  infoCard: { alignItems: 'center', gap: 6, paddingVertical: 20 },
  infoTitle: { fontSize: 15, fontWeight: '800', color: theme.text },
  infoText: { fontSize: 13, color: theme.textSecondary, textAlign: 'center', lineHeight: 18 },
  outlierCard: { borderWidth: 1.5, borderColor: theme.orange + '55' },
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
  trendText: { fontSize: 11, fontWeight: '700' },
  flagTitle: { fontSize: 12, fontWeight: '700', color: theme.textSecondary, marginHorizontal: 20, marginTop: 18, marginBottom: 8, letterSpacing: 0.5, textTransform: 'uppercase' },
  flagLabel: { flex: 1, fontSize: 14, fontWeight: '600', color: theme.text },
  flagValue: { fontSize: 14, fontWeight: '800', color: theme.accentDark },
  fab: { position: 'absolute', right: 20, width: 58, height: 58, borderRadius: 29, backgroundColor: theme.accent, alignItems: 'center', justifyContent: 'center', ...theme.shadowLg },
  infoOverlay: { flex: 1, backgroundColor: '#00000070', alignItems: 'center', justifyContent: 'center', padding: 32 },
  infoModal: { width: '100%', maxWidth: 400, backgroundColor: theme.card, borderRadius: 20, padding: 24, gap: 10 },
  infoModalHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  infoModalTitle: { fontSize: 17, fontWeight: '800', color: theme.text },
  infoModalText: { fontSize: 14, color: theme.textSecondary, lineHeight: 20 },
  infoModalBold: { fontWeight: '700', color: theme.text },
  infoModalBtn: { backgroundColor: theme.accent, borderRadius: 12, paddingVertical: 12, alignItems: 'center', marginTop: 8 },
  infoModalBtnText: { fontSize: 15, fontWeight: '700', color: '#000' },
});
