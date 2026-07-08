import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTheme, Theme, formatBRL } from '../theme';
import { useResponsive } from '../hooks/useResponsive';
import { useCar } from '../contexts/CarContext';
import { Installment, hasFinancing, isCurrentMonth } from '../types';
import { installmentService } from '../services/installmentService';
import { AddFinancingSheet } from '../components/AddFinancingSheet';
import { RootStackParamList, TAB_BAR_BOTTOM_OFFSET } from '../navigation';
import { formatDate, daysUntil } from '../utils/date';
import { showAlert, showConfirm } from '../utils/dialogs';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export const FinancingScreen: React.FC = () => {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const { contentStyle } = useResponsive();
  const navigation = useNavigation<Nav>();
  const { financingId, readOnly, ownerUsername, car, loading, reload } = useCar();
  const [showAddFinancing, setShowAddFinancing] = useState(false);

  useFocusEffect(useCallback(() => { reload().catch(() => null); }, [reload]));

  if (loading || !car) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color={theme.accentDark} />
      </View>
    );
  }

  if (!hasFinancing(car)) {
    return (
      <View style={[styles.container, styles.center]}>
        <Ionicons name="card-outline" size={56} color={theme.textTertiary} />
        <Text style={styles.emptyTitle}>Sem financiamento</Text>
        <Text style={styles.emptySub}>Este carro não tem financiamento cadastrado.</Text>
        {!readOnly && (
          <TouchableOpacity style={styles.emptyBtn} onPress={() => setShowAddFinancing(true)}>
            <Text style={styles.emptyBtnText}>Adicionar financiamento</Text>
          </TouchableOpacity>
        )}
        <AddFinancingSheet
          visible={showAddFinancing}
          financingId={financingId}
          onClose={() => setShowAddFinancing(false)}
          onSaved={() => { setShowAddFinancing(false); reload().catch(() => null); }}
        />
      </View>
    );
  }

  const installments = car.installments;
  const paid = installments.filter(i => i.payment);
  const unpaid = installments.filter(i => !i.payment);
  const paidTotal = paid.reduce((s, i) => s + (i.payment?.paidAmount ?? 0), 0);
  const remainingTotal = unpaid.reduce((s, i) => s + i.amount, 0);
  const progress = installments.length > 0 ? paid.length / installments.length : 0;
  const featured: Installment | undefined = unpaid.find(isCurrentMonth) ?? unpaid[0];
  const days = featured ? daysUntil(featured.dueDate) : 0;

  const quickPay = () => {
    if (!featured) return;
    showConfirm(
      `Pagar parcela ${featured.number}?`,
      `${formatBRL(featured.amount)} — vencimento ${formatDate(featured.dueDate)}`,
      'Pagar',
      async () => {
        try {
          await installmentService.markAsPaid(featured.id, Date.now(), featured.amount, null);
          await reload();
        } catch (e: any) {
          showAlert('Erro', e?.message ?? 'Tente novamente');
        }
      },
    );
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={[{ paddingTop: 12, paddingBottom: TAB_BAR_BOTTOM_OFFSET + 20 }, contentStyle]}>
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
          {car.vehicleValue > 0 && <Row label="Valor do veículo" value={formatBRL(car.vehicleValue)} theme={theme} />}
          {car.bank ? <Row label="Banco" value={car.bank} theme={theme} /> : null}
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
            {!readOnly && (
              <TouchableOpacity style={styles.quickPayBtn} onPress={quickPay}>
                <Text style={styles.quickPayBtnText}>Pagar agora</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {!featured && (
          <View style={[styles.card, styles.doneCard]}>
            <Ionicons name="trophy" size={36} color={theme.orange} />
            <Text style={styles.doneTitle}>Financiamento quitado! 🎉</Text>
          </View>
        )}

        <View style={styles.card}>
          <NavRow icon="list-outline" label="Ver todas as parcelas" onPress={() => navigation.navigate('Installments', { financingId, readOnly: readOnly ?? false })} theme={theme} styles={styles} />
          <View style={styles.sep} />
          <NavRow icon="bar-chart-outline" label="Relatório" onPress={() => navigation.navigate('Report', { financingId })} theme={theme} styles={styles} />
          {!readOnly && (
            <>
              <View style={styles.sep} />
              <NavRow icon="trending-down-outline" label="Simular antecipação" onPress={() => navigation.navigate('Simulation', { financingId })} theme={theme} styles={styles} />
            </>
          )}
        </View>

        {ownerUsername ? (
          <View style={styles.card}>
            <Text style={styles.ownerNote}>Financiamento de: @{ownerUsername}</Text>
          </View>
        ) : null}
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
  center: { alignItems: 'center', justifyContent: 'center', gap: 10, paddingHorizontal: 40 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: theme.text, marginTop: 4 },
  emptySub: { fontSize: 14, color: theme.textSecondary, textAlign: 'center', lineHeight: 20 },
  emptyBtn: { marginTop: 12, backgroundColor: theme.accent, borderRadius: 14, paddingHorizontal: 24, paddingVertical: 13, ...theme.shadowMd },
  emptyBtnText: { fontSize: 15, fontWeight: '800', color: '#000' },
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
  ownerNote: { fontSize: 14, fontWeight: '600', color: theme.textSecondary },
});
