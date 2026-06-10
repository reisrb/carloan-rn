import React, { useCallback, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme, Theme, formatBRL } from '../theme';
import { useResponsive } from '../hooks/useResponsive';
import { FinancingWithInstallments, InstallmentRow, isCurrentMonth } from '../types';
import { financingService } from '../services/financingService';
import { loanCalculator } from '../services/loanCalculator';
import { RootStackParamList, TAB_BAR_BOTTOM_OFFSET } from '../navigation';
import { formatDate } from '../utils/date';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Route = RouteProp<RootStackParamList, 'Simulation'>;
type Mode = 'term' | 'monthly';

export const SimulationScreen: React.FC = () => {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const { contentStyle } = useResponsive();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const { financingId } = route.params;
  const [financing, setFinancing] = useState<FinancingWithInstallments | null>(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [mode, setMode] = useState<Mode>('term');

  useFocusEffect(useCallback(() => {
    financingService.getById(financingId)
      .then(setFinancing)
      .catch(() => null)
      .finally(() => setLoading(false));
  }, [financingId]));

  if (loading || !financing) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color={theme.accentDark} />
      </View>
    );
  }

  const allRows: InstallmentRow[] = financing.installments.map(i => ({
    number: i.number,
    dueDate: i.dueDate,
    amount: i.amount,
    principalAmount: i.principalAmount,
    interestAmount: i.interestAmount,
    remainingBalance: i.remainingBalance,
  }));
  const paidNumbers = new Set(financing.installments.filter(i => i.payment).map(i => i.number));
  const unpaid = financing.installments.filter(i => !i.payment);

  const result = selected.size > 0
    ? loanCalculator.amortize(allRows, paidNumbers, selected, financing.monthlyRate)
    : null;

  const toggle = (number: number) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(number)) next.delete(number);
      else next.add(number);
      return next;
    });
  };

  const presets: { label: string; numbers: () => number[] }[] = [
    { label: 'Última', numbers: () => unpaid.slice(-1).map(i => i.number) },
    { label: 'Últimas 2', numbers: () => unpaid.slice(-2).map(i => i.number) },
    { label: 'Últimas 3', numbers: () => unpaid.slice(-3).map(i => i.number) },
    { label: 'Últimas 6', numbers: () => unpaid.slice(-6).map(i => i.number) },
    { label: 'Todas', numbers: () => unpaid.map(i => i.number) },
  ];

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={[{ paddingTop: insets.top + 8, paddingBottom: TAB_BAR_BOTTOM_OFFSET + 20 }, contentStyle]}>
        <View style={styles.topBar}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={28} color={theme.accentDark} />
          </TouchableOpacity>
          <Text style={styles.topTitle}>Antecipação</Text>
          <View style={{ width: 36 }} />
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.presets}>
          {presets.map(p => (
            <TouchableOpacity key={p.label} style={styles.presetChip} onPress={() => setSelected(new Set(p.numbers()))}>
              <Text style={styles.presetText}>{p.label}</Text>
            </TouchableOpacity>
          ))}
          {selected.size > 0 && (
            <TouchableOpacity style={[styles.presetChip, { backgroundColor: theme.spend + '14' }]} onPress={() => setSelected(new Set())}>
              <Text style={[styles.presetText, { color: theme.spend }]}>Limpar</Text>
            </TouchableOpacity>
          )}
        </ScrollView>

        <View style={styles.segControl}>
          <TouchableOpacity style={[styles.seg, mode === 'term' && styles.segActive]} onPress={() => setMode('term')}>
            <Text style={[styles.segText, mode === 'term' && styles.segTextActive]}>Reduzir prazo</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.seg, mode === 'monthly' && styles.segActive]} onPress={() => setMode('monthly')}>
            <Text style={[styles.segText, mode === 'monthly' && styles.segTextActive]}>Reduzir prestação</Text>
          </TouchableOpacity>
        </View>

        {result && (
          <View style={[styles.card, styles.resultCard]}>
            <Row label={`Parcelas selecionadas`} value={`${result.selectedNumbers.length}`} theme={theme} />
            <Row label="Pagar agora (amortização)" value={formatBRL(result.principalToPayNow)} theme={theme} />
            <Row label="Juros evitados nas selecionadas" value={formatBRL(result.interestSkipped)} theme={theme} />
            <View style={styles.resultSep} />
            {mode === 'term' ? (
              <>
                <Row label="Novas parcelas restantes" value={`${result.reduceTerm.newInstallmentCount}`} theme={theme} />
                {result.reduceTerm.newPayoffDate && (
                  <Row label="Quitação em" value={formatDate(result.reduceTerm.newPayoffDate)} theme={theme} />
                )}
                <Row label="Juros economizados" value={formatBRL(result.reduceTerm.totalInterestSaved)} theme={theme} color="#22C55E" />
              </>
            ) : (
              <>
                <Row label="Nova prestação" value={formatBRL(result.reduceMonthly.newMonthlyPayment)} theme={theme} />
                <Row label="Economia por mês" value={formatBRL(result.reduceMonthly.savingPerMonth)} theme={theme} />
                <Row label="Juros economizados" value={formatBRL(result.reduceMonthly.totalInterestSaved)} theme={theme} color="#22C55E" />
              </>
            )}
          </View>
        )}

        <Text style={styles.sectionHeader}>SELECIONE AS PARCELAS</Text>
        <View style={styles.card}>
          {unpaid.length === 0 && <Text style={styles.empty}>Nenhuma parcela em aberto</Text>}
          {unpaid.map((i, idx) => {
            const isSelected = selected.has(i.number);
            return (
              <View key={i.id}>
                {idx > 0 && <View style={styles.sep} />}
                <TouchableOpacity
                  style={[styles.instRow, isSelected && { backgroundColor: theme.accentSubtle }]}
                  onPress={() => toggle(i.number)}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name={isSelected ? 'checkmark-circle' : 'ellipse-outline'}
                    size={22}
                    color={isSelected ? theme.accentDark : theme.textTertiary}
                  />
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <Text style={styles.instNumber}>Parcela {i.number}</Text>
                      {isCurrentMonth(i) && (
                        <View style={styles.monthBadge}>
                          <Text style={styles.monthBadgeText}>Este mês</Text>
                        </View>
                      )}
                    </View>
                    <Text style={styles.instDate}>{formatDate(i.dueDate)}</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={styles.instAmount}>{formatBRL(i.principalAmount)}</Text>
                    <Text style={styles.instSub}>amortização</Text>
                  </View>
                </TouchableOpacity>
              </View>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
};

const Row: React.FC<{ label: string; value: string; theme: Theme; color?: string }> = ({ label, value, theme, color }) => (
  <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 }}>
    <Text style={{ fontSize: 13, color: theme.textSecondary, flexShrink: 1 }}>{label}</Text>
    <Text style={{ fontSize: 14, fontWeight: '700', color: color ?? theme.text }}>{value}</Text>
  </View>
);

const makeStyles = (theme: Theme) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.bg },
  center: { alignItems: 'center', justifyContent: 'center' },
  topBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, marginBottom: 8 },
  backBtn: { padding: 4 },
  topTitle: { flex: 1, fontSize: 20, fontWeight: '800', color: theme.text, textAlign: 'center' },
  presets: { gap: 8, paddingHorizontal: 16, paddingBottom: 12 },
  presetChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 18, backgroundColor: theme.card, ...theme.shadow },
  presetText: { fontSize: 13, fontWeight: '600', color: theme.accentDark },
  segControl: {
    flexDirection: 'row', marginHorizontal: 16, marginBottom: 12, backgroundColor: theme.card,
    borderRadius: 12, overflow: 'hidden', ...theme.shadow,
  },
  seg: { flex: 1, paddingVertical: 11, alignItems: 'center' },
  segActive: { backgroundColor: theme.accent },
  segText: { fontSize: 13, fontWeight: '600', color: theme.textSecondary },
  segTextActive: { color: '#000', fontWeight: '700' },
  card: { marginHorizontal: 16, marginBottom: 12, backgroundColor: theme.card, borderRadius: 16, overflow: 'hidden', ...theme.shadow },
  resultCard: { padding: 16, borderWidth: 1.5, borderColor: theme.accentBorder },
  resultSep: { height: StyleSheet.hairlineWidth, backgroundColor: theme.separator, marginVertical: 6 },
  sectionHeader: { fontSize: 12, fontWeight: '700', color: theme.textSecondary, marginHorizontal: 16, marginBottom: 8, letterSpacing: 0.5 },
  sep: { height: StyleSheet.hairlineWidth, backgroundColor: theme.separator, marginHorizontal: 16 },
  instRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  instNumber: { fontSize: 15, fontWeight: '600', color: theme.text },
  instDate: { fontSize: 12, color: theme.textSecondary },
  instAmount: { fontSize: 14, fontWeight: '700', color: theme.text },
  instSub: { fontSize: 10, color: theme.textTertiary },
  monthBadge: { backgroundColor: theme.orange + '22', borderRadius: 8, paddingHorizontal: 7, paddingVertical: 2 },
  monthBadgeText: { fontSize: 10, fontWeight: '700', color: theme.orange },
  empty: { padding: 20, textAlign: 'center', color: theme.textSecondary, fontSize: 14 },
});
