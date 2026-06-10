import React, { useCallback, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Platform, Share,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme, Theme, formatBRL } from '../theme';
import { useResponsive } from '../hooks/useResponsive';
import { FinancingWithInstallments, installmentStatus } from '../types';
import { financingService } from '../services/financingService';
import { STATUS_COLORS, STATUS_LABELS } from '../components/StatusBadge';
import { RootStackParamList, TAB_BAR_BOTTOM_OFFSET } from '../navigation';
import { formatDateShort } from '../utils/date';
import { showAlert } from '../utils/dialogs';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Route = RouteProp<RootStackParamList, 'Report'>;

export const ReportScreen: React.FC = () => {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const { contentStyle } = useResponsive();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const { financingId } = route.params;
  const [financing, setFinancing] = useState<FinancingWithInstallments | null>(null);
  const [loading, setLoading] = useState(true);

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

  const installments = financing.installments;
  const paid = installments.filter(i => installmentStatus(i) === 'paid');
  const open = installments.filter(i => installmentStatus(i) === 'open');
  const overdue = installments.filter(i => installmentStatus(i) === 'overdue');
  const paidTotal = paid.reduce((s, i) => s + (i.payment?.paidAmount ?? 0), 0);
  const remainingTotal = installments.filter(i => !i.payment).reduce((s, i) => s + i.amount, 0);
  const principalPaid = paid.reduce((s, i) => s + i.principalAmount, 0);
  const interestPaid = paid.reduce((s, i) => s + i.interestAmount, 0);

  const exportReport = async () => {
    if (Platform.OS === 'web') {
      window.print();
      return;
    }
    const lines = [
      `Relatório — ${financing.carName}${financing.bank ? ` (${financing.bank})` : ''}`,
      '',
      `Parcelas: ${paid.length} pagas / ${installments.length}`,
      `Abertas: ${open.length} · Vencidas: ${overdue.length}`,
      `Total pago: ${formatBRL(paidTotal)}`,
      `Restante: ${formatBRL(remainingTotal)}`,
      `Amortização paga: ${formatBRL(principalPaid)}`,
      `Juros pagos: ${formatBRL(interestPaid)}`,
    ];
    try {
      await Share.share({ message: lines.join('\n') });
    } catch (e: any) {
      showAlert('Erro', e?.message ?? 'Não foi possível compartilhar');
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={[{ paddingTop: insets.top + 8, paddingBottom: TAB_BAR_BOTTOM_OFFSET + 20 }, contentStyle]}>
        <View style={styles.topBar}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={28} color={theme.accentDark} />
          </TouchableOpacity>
          <Text style={styles.topTitle}>Relatório</Text>
          <TouchableOpacity onPress={exportReport} style={styles.exportBtn}>
            <Ionicons name="share-outline" size={22} color={theme.accentDark} />
          </TouchableOpacity>
        </View>

        <View style={styles.card}>
          <Text style={styles.carName}>{financing.carName}</Text>
          {financing.bank ? <Text style={styles.bank}>{financing.bank}</Text> : null}
          <View style={styles.statRow}>
            <Stat label="Pagas" value={`${paid.length}`} color="#22C55E" theme={theme} />
            <Stat label="Abertas" value={`${open.length}`} color="#60A5FA" theme={theme} />
            <Stat label="Vencidas" value={`${overdue.length}`} color="#FF3B30" theme={theme} />
          </View>
        </View>

        <View style={styles.card}>
          <Row label="Total pago" value={formatBRL(paidTotal)} theme={theme} color="#22C55E" />
          <Row label="Total restante" value={formatBRL(remainingTotal)} theme={theme} color={theme.orange} />
          <Row label="Amortização paga" value={formatBRL(principalPaid)} theme={theme} />
          <Row label="Juros pagos" value={formatBRL(interestPaid)} theme={theme} />
        </View>

        <View style={styles.card}>
          <View style={styles.tableHeader}>
            <Text style={[styles.th, { width: 36 }]}>#</Text>
            <Text style={[styles.th, { width: 76 }]}>Data</Text>
            <Text style={[styles.th, { flex: 1, textAlign: 'right' }]}>Valor</Text>
            <Text style={[styles.th, { width: 86, textAlign: 'right' }]}>Status</Text>
          </View>
          {installments.map(i => {
            const status = installmentStatus(i);
            return (
              <View key={i.id} style={styles.tableRow}>
                <Text style={[styles.td, { width: 36 }]}>{i.number}</Text>
                <Text style={[styles.td, { width: 76 }]}>{formatDateShort(i.dueDate)}</Text>
                <Text style={[styles.td, { flex: 1, textAlign: 'right', fontWeight: '600' }]}>{formatBRL(i.amount)}</Text>
                <Text style={[styles.td, { width: 86, textAlign: 'right', color: STATUS_COLORS[status], fontWeight: '700' }]}>
                  {STATUS_LABELS[status]}
                </Text>
              </View>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
};

const Stat: React.FC<{ label: string; value: string; color: string; theme: Theme }> = ({ label, value, color, theme }) => (
  <View style={{ flex: 1, alignItems: 'center', gap: 2 }}>
    <Text style={{ fontSize: 22, fontWeight: '900', color }}>{value}</Text>
    <Text style={{ fontSize: 12, color: theme.textSecondary }}>{label}</Text>
  </View>
);

const Row: React.FC<{ label: string; value: string; theme: Theme; color?: string }> = ({ label, value, theme, color }) => (
  <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 7 }}>
    <Text style={{ fontSize: 14, color: theme.textSecondary }}>{label}</Text>
    <Text style={{ fontSize: 14, fontWeight: '700', color: color ?? theme.text }}>{value}</Text>
  </View>
);

const makeStyles = (theme: Theme) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.bg },
  center: { alignItems: 'center', justifyContent: 'center' },
  topBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, marginBottom: 12 },
  backBtn: { padding: 4 },
  topTitle: { flex: 1, fontSize: 20, fontWeight: '800', color: theme.text, textAlign: 'center' },
  exportBtn: { padding: 8 },
  card: { marginHorizontal: 16, marginBottom: 12, backgroundColor: theme.card, borderRadius: 16, padding: 16, ...theme.shadow },
  carName: { fontSize: 18, fontWeight: '800', color: theme.text },
  bank: { fontSize: 13, color: theme.textSecondary, marginBottom: 8 },
  statRow: { flexDirection: 'row', marginTop: 10 },
  tableHeader: { flexDirection: 'row', paddingBottom: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: theme.border },
  th: { fontSize: 11, fontWeight: '700', color: theme.textSecondary, letterSpacing: 0.3 },
  tableRow: { flexDirection: 'row', paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: theme.separator },
  td: { fontSize: 13, color: theme.text },
});
