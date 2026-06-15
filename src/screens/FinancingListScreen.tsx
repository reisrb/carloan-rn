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
import { sharingService } from '../services/sharingService';
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
  const [sharedFinancings, setSharedFinancings] = useState<Array<Financing & { shareId: string; permission: 'view' | 'edit'; ownerUsername?: string }>>([]);
  const [paidCounts, setPaidCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showAdd, setShowAdd] = useState(false);

  const load = useCallback(async () => {
    const [ownData, sharedShares] = await Promise.all([
      financingService.getAll(),
      sharingService.getSharedWithMe(),
    ]);

    const allIds = [...ownData.map(f => f.id)];
    if (sharedShares.length > 0) {
      allIds.push(...sharedShares.map(s => s.financingId));
    }

    const counts: Record<string, number> = {};
    if (allIds.length > 0) {
      const { data: rows } = await supabase
        .from('payments')
        .select('installment_id, installments!inner(financing_id)')
        .in('installments.financing_id', allIds);
      for (const row of (rows as any[]) ?? []) {
        const fid = row.installments.financing_id;
        counts[fid] = (counts[fid] ?? 0) + 1;
      }
    }

    let sharedResult: Array<Financing & { shareId: string; permission: 'view' | 'edit'; ownerUsername?: string }> = [];
    if (sharedShares.length > 0) {
      const sharedIds = sharedShares.map(s => s.financingId);
      const sharedData = await financingService.getByIds(sharedIds);
      const sharedDataMap = sharedData.reduce((acc, f) => { acc[f.id] = f; return acc; }, {} as Record<string, Financing>);
      sharedResult = sharedShares
        .map(s => {
          const f = sharedDataMap[s.financingId];
          return f ? { ...f, shareId: s.id, permission: s.permission, ownerUsername: s.ownerUsername } : null;
        })
        .filter((x): x is typeof sharedResult[0] => x !== null);
    }

    setFinancings(ownData);
    setPaidCounts(counts);
    setSharedFinancings(sharedResult);
  }, []);

  useFocusEffect(useCallback(() => {
    showTabBar();
    setLoading(true);
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

  const data = [
    { type: 'header', label: 'Meus financiamentos' },
    ...financings.map(f => ({ type: 'own', financing: f })),
    ...(financings.length === 0 ? [{ type: 'empty' }] : []),
    ...(sharedFinancings.length > 0 ? [{ type: 'shared-header', label: 'Financiamentos compartilhados' }] : []),
    ...sharedFinancings.map(f => ({ type: 'shared', financing: f, shareId: f.shareId })),
  ];

  return (
    <View style={styles.container}>
      <FlatList
        data={data}
        keyExtractor={(item, idx) => {
          if ('financing' in item) return item.financing.id;
          return `${item.type}-${idx}`;
        }}
        contentContainerStyle={[{ paddingTop: insets.top + 12, paddingBottom: TAB_BAR_BOTTOM_OFFSET + 80 }, contentStyle]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.accentDark} />}
        renderItem={({ item }: any) => {
          if (item.type === 'header') {
            return <Text style={styles.title}>{item.label}</Text>;
          }
          if (item.type === 'shared-header') {
            return <Text style={[styles.title, { fontSize: 18, marginTop: 20 }]}>{item.label}</Text>;
          }
          if (item.type === 'empty') {
            return (
              <View style={styles.empty}>
                <Ionicons name="car-sport-outline" size={56} color={theme.textTertiary} />
                <Text style={styles.emptyTitle}>Nenhum financiamento</Text>
                <Text style={styles.emptySub}>Toque em + para adicionar o financiamento do seu veículo.</Text>
              </View>
            );
          }
          const isReadOnly = item.type === 'shared' && item.financing.permission === 'view';
          const ownerUsername: string | undefined = item.type === 'shared' ? item.financing.ownerUsername : undefined;
          return (
            <FinancingCard
              financing={item.financing}
              paidCount={paidCounts[item.financing.id] ?? 0}
              ownerUsername={ownerUsername}
              onPress={() => navigation.navigate('Dashboard', { financingId: item.financing.id, readOnly: isReadOnly, ownerUsername })}
            />
          );
        }}
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
