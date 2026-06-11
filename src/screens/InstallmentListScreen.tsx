import React, { useCallback, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme, Theme } from '../theme';
import { useResponsive } from '../hooks/useResponsive';
import { Installment, InstallmentStatus, installmentStatus } from '../types';
import { financingService } from '../services/financingService';
import { InstallmentRowItem } from '../components/InstallmentRowItem';
import { RootStackParamList, TAB_BAR_BOTTOM_OFFSET } from '../navigation';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Route = RouteProp<RootStackParamList, 'Installments'>;
type Filter = 'all' | InstallmentStatus;

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'Todas' },
  { key: 'paid', label: 'Pagas' },
  { key: 'open', label: 'Abertas' },
  { key: 'overdue', label: 'Vencidas' },
];

export const InstallmentListScreen: React.FC = () => {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const { contentStyle } = useResponsive();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const { financingId, readOnly } = route.params;
  const [installments, setInstallments] = useState<Installment[]>([]);
  const [filter, setFilter] = useState<Filter>('all');
  const [loading, setLoading] = useState(true);

  useFocusEffect(useCallback(() => {
    financingService.getInstallments(financingId)
      .then(setInstallments)
      .catch(() => null)
      .finally(() => setLoading(false));
  }, [financingId]));

  const filtered = filter === 'all'
    ? installments
    : installments.filter(i => installmentStatus(i) === filter);

  if (loading) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color={theme.accentDark} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={28} color={theme.accentDark} />
        </TouchableOpacity>
        <Text style={styles.topTitle}>Parcelas</Text>
        <View style={{ width: 36 }} />
      </View>

      <View style={styles.filters}>
        {FILTERS.map(f => (
          <TouchableOpacity
            key={f.key}
            style={[styles.chip, filter === f.key && styles.chipActive]}
            onPress={() => setFilter(f.key)}
          >
            <Text style={[styles.chipText, filter === f.key && styles.chipTextActive]}>{f.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <FlatList
        data={filtered}
        keyExtractor={i => i.id}
        contentContainerStyle={[{ paddingBottom: TAB_BAR_BOTTOM_OFFSET + 20 }, contentStyle]}
        ListEmptyComponent={
          <Text style={styles.empty}>Nenhuma parcela neste filtro</Text>
        }
        renderItem={({ item, index }) => (
          <View style={[styles.rowCard, index === 0 && { marginTop: 4 }]}>
            <InstallmentRowItem
              installment={item}
              onPress={() => navigation.navigate('InstallmentDetail', { financingId, installmentId: item.id, readOnly })}
            />
          </View>
        )}
      />
    </View>
  );
};

const makeStyles = (theme: Theme) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.bg },
  center: { alignItems: 'center', justifyContent: 'center' },
  topBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, marginBottom: 8 },
  backBtn: { padding: 4 },
  topTitle: { flex: 1, fontSize: 20, fontWeight: '800', color: theme.text, textAlign: 'center' },
  filters: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, marginBottom: 12 },
  chip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 18, backgroundColor: theme.card, ...theme.shadow },
  chipActive: { backgroundColor: theme.accent },
  chipText: { fontSize: 13, fontWeight: '600', color: theme.textSecondary },
  chipTextActive: { color: '#000' },
  rowCard: { marginHorizontal: 16, marginBottom: 8, backgroundColor: theme.card, borderRadius: 14, ...theme.shadow },
  empty: { textAlign: 'center', color: theme.textSecondary, marginTop: 40, fontSize: 14 },
});
