import React, { useCallback, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme, Theme } from '../theme';
import { useResponsive } from '../hooks/useResponsive';
import { Financing } from '../types';
import { financingService } from '../services/financingService';
import { supabase } from '../lib/supabase';
import { FinancingCard } from '../components/FinancingCard';
import { AddFinancingSheet } from '../components/AddFinancingSheet';
import { RootStackParamList, TAB_BAR_BOTTOM_OFFSET } from '../navigation';
import { showTabBar } from '../navigation/tabBarController';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export const FinancingListScreen: React.FC = () => {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const { contentStyle } = useResponsive();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<Nav>();
  const [financings, setFinancings] = useState<Financing[]>([]);
  const [paidCounts, setPaidCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showAdd, setShowAdd] = useState(false);

  const load = useCallback(async () => {
    const data = await financingService.getAll();
    setFinancings(data);

    const counts: Record<string, number> = {};
    if (data.length > 0) {
      const { data: rows } = await supabase
        .from('payments')
        .select('installment_id, installments!inner(financing_id)')
        .in('installments.financing_id', data.map(f => f.id));
      for (const row of (rows as any[]) ?? []) {
        const fid = row.installments.financing_id;
        counts[fid] = (counts[fid] ?? 0) + 1;
      }
    }
    setPaidCounts(counts);
  }, []);

  useFocusEffect(useCallback(() => {
    showTabBar();
    load().catch(() => null).finally(() => setLoading(false));
  }, [load]));

  const onRefresh = async () => {
    setRefreshing(true);
    await load().catch(() => null);
    setRefreshing(false);
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color={theme.accentDark} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={financings}
        keyExtractor={f => f.id}
        contentContainerStyle={[{ paddingTop: insets.top + 12, paddingBottom: TAB_BAR_BOTTOM_OFFSET + 80 }, contentStyle]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.accentDark} />}
        ListHeaderComponent={
          <Text style={styles.title}>Meus financiamentos</Text>
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="car-sport-outline" size={56} color={theme.textTertiary} />
            <Text style={styles.emptyTitle}>Nenhum financiamento</Text>
            <Text style={styles.emptySub}>Toque em + para adicionar o financiamento do seu veículo.</Text>
          </View>
        }
        renderItem={({ item }) => (
          <FinancingCard
            financing={item}
            paidCount={paidCounts[item.id] ?? 0}
            onPress={() => navigation.navigate('Dashboard', { financingId: item.id })}
          />
        )}
      />

      <TouchableOpacity
        style={[styles.fab, { bottom: TAB_BAR_BOTTOM_OFFSET + 16 }]}
        onPress={() => setShowAdd(true)}
        activeOpacity={0.85}
      >
        <Ionicons name="add" size={30} color="#000" />
      </TouchableOpacity>

      <AddFinancingSheet
        visible={showAdd}
        onClose={() => setShowAdd(false)}
        onCreated={() => { setShowAdd(false); load().catch(() => null); }}
      />
    </View>
  );
};

const makeStyles = (theme: Theme) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.bg },
  center: { alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 28, fontWeight: '900', color: theme.text, marginHorizontal: 16, marginBottom: 16 },
  empty: { alignItems: 'center', gap: 10, marginTop: 80, paddingHorizontal: 40 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: theme.text },
  emptySub: { fontSize: 14, color: theme.textSecondary, textAlign: 'center', lineHeight: 20 },
  fab: {
    position: 'absolute', right: 20, width: 58, height: 58, borderRadius: 29,
    backgroundColor: theme.accent, alignItems: 'center', justifyContent: 'center', ...theme.shadowLg,
  },
});
