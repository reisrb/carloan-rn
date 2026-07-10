import React, { useCallback, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Platform, Share,
} from 'react-native';
import * as Print from 'expo-print';
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

  const buildHtmlReport = () => {
    const rowsHtml = installments.map(i => {
      const status = installmentStatus(i);
      const statusLabel = STATUS_LABELS[status];
      const statusColor = STATUS_COLORS[status];
      return `
        <tr>
          <td style="border-bottom: 1px solid #e0e0e0; padding: 8px; text-align: center;">${i.number}</td>
          <td style="border-bottom: 1px solid #e0e0e0; padding: 8px;">${formatDateShort(i.dueDate)}</td>
          <td style="border-bottom: 1px solid #e0e0e0; padding: 8px; text-align: right; font-weight: bold;">${formatBRL(i.amount)}</td>
          <td style="border-bottom: 1px solid #e0e0e0; padding: 8px; text-align: right; color: ${statusColor}; font-weight: bold;">${statusLabel}</td>
        </tr>
      `;
    }).join('');

    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8" />
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; color: #000; background: #fff; }
            h1 { margin: 0 0 4px 0; font-size: 24px; }
            h2 { margin: 16px 0 8px 0; font-size: 14px; text-transform: uppercase; color: #666; }
            .section { margin-bottom: 20px; }
            table { width: 100%; border-collapse: collapse; }
            th { background: #f5f5f5; padding: 8px; text-align: left; font-weight: bold; font-size: 12px; color: #666; border-bottom: 1px solid #e0e0e0; }
            td { padding: 8px; }
            .row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #e0e0e0; }
            .label { color: #666; }
            .value { font-weight: bold; }
            .bank { color: #999; font-size: 12px; }
          </style>
        </head>
        <body>
          <h1>${financing.carName}</h1>
          ${financing.bank ? `<div class="bank">${financing.bank}</div>` : ''}

          <div class="section">
            <h2>Resumo</h2>
            <div class="row"><span class="label">Total pago:</span><span class="value">${formatBRL(paidTotal)}</span></div>
            <div class="row"><span class="label">Restante:</span><span class="value">${formatBRL(remainingTotal)}</span></div>
            <div class="row"><span class="label">Amortização paga:</span><span class="value">${formatBRL(principalPaid)}</span></div>
            <div class="row"><span class="label">Juros pagos:</span><span class="value">${formatBRL(interestPaid)}</span></div>
            <div class="row"><span class="label">Parcelas:</span><span class="value">${paid.length} pagas / ${installments.length}</span></div>
          </div>

          <div class="section">
            <h2>Parcelas</h2>
            <table>
              <thead>
                <tr>
                  <th style="width: 10%;">#</th>
                  <th style="width: 20%;">Data</th>
                  <th style="width: 40%; text-align: right;">Valor</th>
                  <th style="width: 30%; text-align: right;">Status</th>
                </tr>
              </thead>
              <tbody>
                ${rowsHtml}
              </tbody>
            </table>
          </div>
        </body>
      </html>
    `;
  };

  const exportReport = async () => {
    try {
      const html = buildHtmlReport();
      if (Platform.OS === 'web') {
        // printToFileAsync is unsupported on web; open the browser print dialog (save as PDF).
        await Print.printAsync({ html });
      } else {
        const filePath = await Print.printToFileAsync({ html, base64: false });
        await Share.share({
          url: filePath.uri,
          message: 'Relatório de financiamento',
          title: `Relatório — ${financing.carName}`,
        });
      }
    } catch (e: any) {
      showAlert('Erro', e?.message ?? 'Não foi possível exportar');
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
