import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useTheme, Theme, formatBRL } from '../theme';
import { useResponsive } from '../hooks/useResponsive';
import { useCar } from '../contexts/CarContext';
import { Accessory, Maintenance, hasFinancing, isCurrentMonth } from '../types';
import { accessoryService } from '../services/accessoryService';
import { maintenanceService } from '../services/maintenanceService';
import { TAB_BAR_BOTTOM_OFFSET } from '../navigation';

export const ExpensesScreen: React.FC = () => {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const { contentStyle } = useResponsive();
  const { financingId, car, loading, reload } = useCar();
  const [accessories, setAccessories] = useState<Accessory[]>([]);
  const [maintenances, setMaintenances] = useState<Maintenance[]>([]);

  useFocusEffect(useCallback(() => {
    reload().catch(() => null);
    accessoryService.listByCar(financingId).then(setAccessories).catch(() => null);
    maintenanceService.listByCar(financingId).then(setMaintenances).catch(() => null);
  }, [financingId, reload]));

  if (loading || !car) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color={theme.accentDark} />
      </View>
    );
  }

  const installments = car.installments;
  const monthInstallmentAmount = installments.filter(i => !i.payment).find(isCurrentMonth)?.amount ?? 0;
  const monthly = monthInstallmentAmount + car.monthlyCost;

  const paidInstallments = installments.reduce((s, i) => s + (i.payment?.paidAmount ?? 0), 0);
  const accTotal = accessories.reduce((s, a) => s + a.value, 0);
  const maintTotal = maintenances.filter(m => m.status === 'done').reduce((s, m) => s + m.totalValue, 0);
  const accumulated = car.downPayment + paidInstallments + accTotal + maintTotal;

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={[{ paddingTop: 12, paddingBottom: TAB_BAR_BOTTOM_OFFSET + 20 }, contentStyle]}>
        <View style={[styles.card, styles.hero]}>
          <Text style={styles.heroLabel}>GASTO MENSAL</Text>
          <Text style={styles.heroValue}>{formatBRL(monthly)}</Text>
          <Text style={styles.heroSub}>
            {hasFinancing(car) ? `parcela ${formatBRL(monthInstallmentAmount)} + fixo ${formatBRL(car.monthlyCost)}` : `fixo ${formatBRL(car.monthlyCost)}`}
          </Text>
        </View>

        <Text style={styles.sectionHeader}>GASTO ACUMULADO</Text>
        <View style={styles.card}>
          {car.downPayment > 0 && <Row label="Entrada" value={formatBRL(car.downPayment)} theme={theme} />}
          {paidInstallments > 0 && <Row label="Parcelas pagas" value={formatBRL(paidInstallments)} theme={theme} />}
          <Row label="Acessórios" value={formatBRL(accTotal)} theme={theme} />
          <Row label="Manutenções" value={formatBRL(maintTotal)} theme={theme} />
          <View style={styles.sep} />
          <Row label="Total" value={formatBRL(accumulated)} theme={theme} bold />
        </View>
      </ScrollView>
    </View>
  );
};

const Row: React.FC<{ label: string; value: string; theme: Theme; bold?: boolean }> = ({ label, value, theme, bold }) => (
  <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8 }}>
    <Text style={{ fontSize: bold ? 15 : 14, fontWeight: bold ? '800' : '400', color: bold ? theme.text : theme.textSecondary }}>{label}</Text>
    <Text style={{ fontSize: bold ? 16 : 14, fontWeight: bold ? '900' : '700', color: theme.text }}>{value}</Text>
  </View>
);

const makeStyles = (theme: Theme) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.bg },
  center: { alignItems: 'center', justifyContent: 'center' },
  card: { marginHorizontal: 16, marginBottom: 12, backgroundColor: theme.card, borderRadius: 16, padding: 16, ...theme.shadow },
  hero: { alignItems: 'center', gap: 4, paddingVertical: 24 },
  heroLabel: { fontSize: 12, fontWeight: '800', letterSpacing: 0.6, color: theme.accentDark },
  heroValue: { fontSize: 34, fontWeight: '900', color: theme.text },
  heroSub: { fontSize: 13, color: theme.textSecondary },
  sectionHeader: { fontSize: 12, fontWeight: '700', color: theme.textSecondary, marginHorizontal: 20, marginBottom: 8, letterSpacing: 0.5 },
  sep: { height: StyleSheet.hairlineWidth, backgroundColor: theme.separator, marginVertical: 4 },
});
