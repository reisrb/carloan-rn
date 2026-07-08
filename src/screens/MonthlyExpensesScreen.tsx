import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme, Theme, formatBRL } from '../theme';
import { useResponsive } from '../hooks/useResponsive';
import { FixedExpense } from '../types';
import { fixedExpenseService } from '../services/fixedExpenseService';
import { AddFixedExpenseSheet } from '../components/AddFixedExpenseSheet';
import { RootStackParamList, TAB_BAR_BOTTOM_OFFSET } from '../navigation';
import { showConfirm, showAlert } from '../utils/dialogs';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Route = RouteProp<RootStackParamList, 'MonthlyExpenses'>;

export const MonthlyExpensesScreen: React.FC = () => {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const { contentStyle } = useResponsive();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const { financingId, readOnly } = route.params;

  const [items, setItems] = useState<FixedExpense[]>([]);
  const [loading, setLoading] = useState(true);
  const [showSheet, setShowSheet] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    fixedExpenseService.listByCar(financingId).then(setItems).catch(() => null).finally(() => setLoading(false));
  }, [financingId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const remove = (e: FixedExpense) => {
    showConfirm('Excluir gasto?', `"${e.name}" será removido.`, 'Excluir', async () => {
      try { await fixedExpenseService.remove(e.id); load(); }
      catch (err: any) { showAlert('Erro', err?.message ?? 'Tente novamente'); }
    });
  };

  const total = items.reduce((s, e) => s + e.value, 0);

  return (
    <View style={styles.container}>
      <View style={[styles.topBar, { paddingTop: insets.top + 4 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={28} color={theme.accentDark} />
        </TouchableOpacity>
        <Text style={styles.topTitle}>Gastos mensais</Text>
        <View style={{ width: 36 }} />
      </View>

      {loading ? (
        <View style={[styles.center, { flex: 1 }]}><ActivityIndicator size="large" color={theme.accentDark} /></View>
      ) : (
        <ScrollView contentContainerStyle={[{ paddingTop: 12, paddingBottom: TAB_BAR_BOTTOM_OFFSET + 80 }, contentStyle]}>
          {items.length === 0 ? (
            <View style={styles.empty}>
              <Ionicons name="repeat-outline" size={52} color={theme.textTertiary} />
              <Text style={styles.emptyTitle}>Nenhum gasto mensal</Text>
              <Text style={styles.emptySub}>Cadastre seguro, IPVA, estacionamento e outros custos recorrentes.</Text>
            </View>
          ) : (
            <>
              {items.map(e => (
                <View key={e.id} style={styles.row}>
                  <View style={styles.bullet} />
                  <Text style={styles.rowName}>{e.name}</Text>
                  <Text style={styles.rowValue}>{formatBRL(e.value)}</Text>
                  {!readOnly && (
                    <TouchableOpacity onPress={() => remove(e)} style={styles.removeBtn}>
                      <Ionicons name="close-circle" size={18} color={theme.textSecondary} />
                    </TouchableOpacity>
                  )}
                </View>
              ))}
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Total mensal fixo</Text>
                <Text style={styles.totalValue}>{formatBRL(total)}</Text>
              </View>
            </>
          )}
        </ScrollView>
      )}

      {!readOnly && (
        <TouchableOpacity style={[styles.fab, { bottom: TAB_BAR_BOTTOM_OFFSET + 16 }]} onPress={() => setShowSheet(true)} activeOpacity={0.85}>
          <Ionicons name="add" size={30} color="#000" />
        </TouchableOpacity>
      )}

      <AddFixedExpenseSheet visible={showSheet} financingId={financingId} onClose={() => setShowSheet(false)} onSaved={() => { setShowSheet(false); load(); }} />
    </View>
  );
};

const makeStyles = (theme: Theme) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.bg },
  center: { alignItems: 'center', justifyContent: 'center' },
  topBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingBottom: 10, backgroundColor: theme.bg, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: theme.border },
  backBtn: { padding: 4 },
  topTitle: { flex: 1, fontSize: 20, fontWeight: '800', color: theme.text, textAlign: 'center' },
  empty: { alignItems: 'center', gap: 10, marginTop: 80, paddingHorizontal: 40 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: theme.text },
  emptySub: { fontSize: 14, color: theme.textSecondary, textAlign: 'center', lineHeight: 20 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, marginHorizontal: 16, marginBottom: 10, backgroundColor: theme.card, borderRadius: 14, padding: 14, ...theme.shadow },
  bullet: { width: 8, height: 8, borderRadius: 4, backgroundColor: theme.accentDark },
  rowName: { flex: 1, fontSize: 15, fontWeight: '700', color: theme.text },
  rowValue: { fontSize: 15, fontWeight: '800', color: theme.text },
  removeBtn: { padding: 2 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', marginHorizontal: 16, marginTop: 6, paddingHorizontal: 4 },
  totalLabel: { fontSize: 14, fontWeight: '700', color: theme.textSecondary },
  totalValue: { fontSize: 16, fontWeight: '900', color: theme.text },
  fab: {
    position: 'absolute', right: 20, width: 58, height: 58, borderRadius: 29,
    backgroundColor: theme.accent, alignItems: 'center', justifyContent: 'center', ...theme.shadowLg,
  },
});
