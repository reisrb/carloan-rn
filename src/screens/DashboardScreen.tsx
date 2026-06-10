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
import { FinancingWithInstallments, Installment, isCurrentMonth } from '../types';
import { financingService } from '../services/financingService';
import { installmentService } from '../services/installmentService';
import { RootStackParamList, TAB_BAR_BOTTOM_OFFSET } from '../navigation';
import { formatDate, daysUntil } from '../utils/date';
import { showAlert, showConfirm } from '../utils/dialogs';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Route = RouteProp<RootStackParamList, 'Dashboard'>;

export const DashboardScreen: React.FC = () => {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const { contentStyle } = useResponsive();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const { financingId } = route.params;
  const [financing, setFinancing] = useState<FinancingWithInstallments | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const data = await financingService.getById(financingId);
    setFinancing(data);
  }, [financingId]);

  useFocusEffect(useCallback(() => {
    load().catch(() => null).finally(() => setLoading(false));
  }, [load]));

  if (loading || !financing) {
    return (
      <View style={[styles.container, styles.center]}>
        {loading ? <ActivityIndicator size="large" color={theme.accentDark} /> : <Text style={{ color: theme.textSecondary }}>Financiamento não encontrado</Text>}
      </View>
    );
  }

  const installments = financing.installments;
  const paid = installments.filter(i => i.payment);
  const unpaid = installments.filter(i => !i.payment);
  const paidTotal = paid.reduce((s, i) => s + (i.payment?.paidAmount ?? 0), 0);
  const remainingTotal = unpaid.reduce((s, i) => s + i.amount, 0);
  const progress = installments.length > 0 ? paid.length / installments.length : 0;

  const featured: Installment | undefined =
    unpaid.find(i => isCurrentMonth(i)) ?? unpaid[0];

  const quickPay = () => {
    if (!featured) return;
    showConfirm(
      `Pagar parcela ${featured.number}?`,
      `${formatBRL(featured.amount)} — vencimento ${formatDate(featured.dueDate)}`,
      'Pagar',
      async () => {
        try {
          await installmentService.markAsPaid(featured.id, Date.now(), featured.amount, null);
          await load();
        } catch (e: any) {
          showAlert('Erro', e?.message ?? 'Tente novamente');
        }
      },
    );
  };

  const days = featured ? daysUntil(featured.dueDate) : 0;

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={[{ paddingTop: insets.top + 8, paddingBottom: TAB_BAR_BOTTOM_OFFSET + 20 }, contentStyle]}>
        <View style={styles.topBar}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={28} color={theme.accentDark} />
          </TouchableOpacity>
          <Text style={styles.topTitle} numberOfLines={1}>{financing.carName}</Text>
          <TouchableOpacity onPress={() => navigation.navigate('EditFinancing', { financingId })} style={styles.editBtn}>
            <Ionicons name="pencil" size={20} color={theme.accentDark} />
          </TouchableOpacity>
        </View>

        <View style={styles.card}>
          <View style={styles.progressHeader}>
            <Text style={styles.progressLabel}>{paid.length} de {installments.length} parcelas</Text>
            <Text style={styles.progressPct}>{Math.round(progress * 100)}%</Text>
          </View>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
          </View>
        </View>

        <View style={styles.card}>
          {financing.vehicleValue > 0 && (
            <Row label="Valor do veículo" value={formatBRL(financing.vehicleValue)} theme={theme} />
          )}
          <Row label="Custo total" value={formatBRL(paidTotal + remainingTotal)} theme={theme} />
          <Row label="Pago" value={formatBRL(paidTotal)} theme={theme} color="#22C55E" />
          <Row label="Restante" value={formatBRL(remainingTotal)} theme={theme} color={theme.orange} />
        </View>

        {featured && (
          <View style={[styles.card, styles.quickPay]}>
            <View style={styles.quickPayHeader}>
              <Text style={styles.quickPayBadge}>{isCurrentMonth(featured) ? 'ESTE MÊS' : 'PRÓXIMA'}</Text>
              <Text style={styles.quickPayDays}>
                {days < 0 ? `${-days} dia${days !== -1 ? 's' : ''} em atraso` : days === 0 ? 'Vence hoje' : `Vence em ${days} dia${days !== 1 ? 's' : ''}`}
              </Text>
            </View>
            <Text style={styles.quickPayTitle}>Parcela {featured.number}</Text>
            <Text style={styles.quickPayAmount}>{formatBRL(featured.amount)}</Text>
            <Text style={styles.quickPayDate}>{formatDate(featured.dueDate)}</Text>
            <TouchableOpacity style={styles.quickPayBtn} onPress={quickPay}>
              <Text style={styles.quickPayBtnText}>Pagar agora</Text>
            </TouchableOpacity>
          </View>
        )}

        {!featured && (
          <View style={[styles.card, styles.doneCard]}>
            <Ionicons name="trophy" size={36} color={theme.orange} />
            <Text style={styles.doneTitle}>Financiamento quitado! 🎉</Text>
          </View>
        )}

        <View style={styles.card}>
          <NavRow icon="list-outline" label="Ver todas as parcelas" onPress={() => navigation.navigate('Installments', { financingId })} theme={theme} styles={styles} />
          <View style={styles.sep} />
          <NavRow icon="bar-chart-outline" label="Relatório" onPress={() => navigation.navigate('Report', { financingId })} theme={theme} styles={styles} />
          <View style={styles.sep} />
          <NavRow icon="trending-down-outline" label="Simular antecipação" onPress={() => navigation.navigate('Simulation', { financingId })} theme={theme} styles={styles} />
        </View>
      </ScrollView>
    </View>
  );
};

const Row: React.FC<{ label: string; value: string; theme: Theme; color?: string }> = ({ label, value, theme, color }) => (
  <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 7 }}>
    <Text style={{ fontSize: 14, color: theme.textSecondary }}>{label}</Text>
    <Text style={{ fontSize: 14, fontWeight: '700', color: color ?? theme.text }}>{value}</Text>
  </View>
);

const NavRow: React.FC<{
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  onPress: () => void;
  theme: Theme;
  styles: ReturnType<typeof makeStyles>;
}> = ({ icon, label, onPress, theme, styles }) => (
  <TouchableOpacity style={styles.navRow} onPress={onPress} activeOpacity={0.7}>
    <Ionicons name={icon} size={20} color={theme.accentDark} />
    <Text style={styles.navRowText}>{label}</Text>
    <Ionicons name="chevron-forward" size={16} color={theme.textTertiary} />
  </TouchableOpacity>
);

const makeStyles = (theme: Theme) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.bg },
  center: { alignItems: 'center', justifyContent: 'center' },
  topBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, marginBottom: 12 },
  backBtn: { padding: 4 },
  topTitle: { flex: 1, fontSize: 20, fontWeight: '800', color: theme.text, textAlign: 'center' },
  editBtn: { padding: 8 },
  card: { marginHorizontal: 16, marginBottom: 12, backgroundColor: theme.card, borderRadius: 16, padding: 16, ...theme.shadow },
  progressHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  progressLabel: { fontSize: 14, fontWeight: '600', color: theme.text },
  progressPct: { fontSize: 14, fontWeight: '800', color: theme.accentDark },
  progressBar: { height: 8, borderRadius: 4, backgroundColor: theme.separator, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 4, backgroundColor: theme.accentDark },
  sep: { height: StyleSheet.hairlineWidth, backgroundColor: theme.separator },
  quickPay: { alignItems: 'center', gap: 4 },
  quickPayHeader: { flexDirection: 'row', justifyContent: 'space-between', alignSelf: 'stretch', marginBottom: 6 },
  quickPayBadge: { fontSize: 11, fontWeight: '800', color: theme.accentDark, letterSpacing: 0.5 },
  quickPayDays: { fontSize: 12, fontWeight: '600', color: theme.textSecondary },
  quickPayTitle: { fontSize: 14, color: theme.textSecondary },
  quickPayAmount: { fontSize: 30, fontWeight: '900', color: theme.text },
  quickPayDate: { fontSize: 13, color: theme.textSecondary },
  quickPayBtn: { marginTop: 10, backgroundColor: theme.accent, borderRadius: 14, paddingHorizontal: 32, paddingVertical: 13, ...theme.shadowMd },
  quickPayBtnText: { fontSize: 15, fontWeight: '800', color: '#000' },
  doneCard: { alignItems: 'center', gap: 8, paddingVertical: 24 },
  doneTitle: { fontSize: 17, fontWeight: '800', color: theme.text },
  navRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 13 },
  navRowText: { flex: 1, fontSize: 15, fontWeight: '600', color: theme.text },
});
