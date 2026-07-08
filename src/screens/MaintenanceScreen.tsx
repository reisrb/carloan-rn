import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useTheme, Theme, formatBRL } from '../theme';
import { useResponsive } from '../hooks/useResponsive';
import { useCar } from '../contexts/CarContext';
import { Maintenance } from '../types';
import { maintenanceService } from '../services/maintenanceService';
import { AddMaintenanceSheet } from '../components/AddMaintenanceSheet';
import { TAB_BAR_BOTTOM_OFFSET } from '../navigation';
import { formatDate, daysUntil } from '../utils/date';
import { showConfirm, showAlert } from '../utils/dialogs';

type PendingBadge = { label: string; color: string };

export const MaintenanceScreen: React.FC = () => {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const { contentStyle } = useResponsive();
  const { financingId, readOnly, car } = useCar();
  const [items, setItems] = useState<Maintenance[]>([]);
  const [loading, setLoading] = useState(true);
  const [showSheet, setShowSheet] = useState(false);
  const [editing, setEditing] = useState<Maintenance | null>(null);

  const currentKm = car?.currentKm ?? 0;

  const load = useCallback(() => {
    setLoading(true);
    maintenanceService.listByCar(financingId).then(setItems).catch(() => null).finally(() => setLoading(false));
  }, [financingId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const pendingBadge = (m: Maintenance): PendingBadge => {
    if (m.dueKm != null && currentKm >= m.dueKm) return { label: 'Vencida', color: '#FF3B30' };
    if (m.dueDate != null) {
      const d = daysUntil(m.dueDate);
      if (d < 0) return { label: 'Vencida', color: '#FF3B30' };
      if (d <= 15) return { label: `Vence em ${d}d`, color: theme.orange };
    }
    if (m.dueKm != null && m.dueKm - currentKm <= 1000) return { label: `Faltam ${(m.dueKm - currentKm).toLocaleString('pt-BR')} km`, color: theme.orange };
    return { label: 'Em dia', color: '#22C55E' };
  };

  const openNew = () => { setEditing(null); setShowSheet(true); };
  const openEdit = (m: Maintenance) => { if (readOnly) return; setEditing(m); setShowSheet(true); };

  const remove = (m: Maintenance) => {
    showConfirm('Excluir manutenção?', `"${m.description}" será removida.`, 'Excluir', async () => {
      try { await maintenanceService.remove(m.id); load(); }
      catch (e: any) { showAlert('Erro', e?.message ?? 'Tente novamente'); }
    });
  };

  if (loading) {
    return <View style={[styles.container, styles.center]}><ActivityIndicator size="large" color={theme.accentDark} /></View>;
  }

  const pending = items.filter(m => m.status === 'pending');
  const done = items.filter(m => m.status === 'done');

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={[{ paddingTop: 12, paddingBottom: TAB_BAR_BOTTOM_OFFSET + 80 }, contentStyle]}>
        <Text style={styles.sectionTitle}>Pendentes</Text>
        {pending.length === 0 ? (
          <Text style={styles.emptyLine}>Nenhuma manutenção pendente.</Text>
        ) : pending.map(m => {
          const badge = pendingBadge(m);
          return (
            <TouchableOpacity key={m.id} style={styles.card} activeOpacity={0.7} onPress={() => openEdit(m)}>
              <View style={styles.cardHead}>
                <Text style={styles.cardTitle} numberOfLines={2}>{m.description}</Text>
                <View style={[styles.badge, { backgroundColor: badge.color + '22' }]}>
                  <Text style={[styles.badgeText, { color: badge.color }]}>{badge.label}</Text>
                </View>
              </View>
              <Text style={styles.cardMeta}>
                {[m.dueKm != null ? `${m.dueKm.toLocaleString('pt-BR')} km` : null, m.dueDate != null ? formatDate(m.dueDate) : null].filter(Boolean).join(' · ') || 'Sem previsão'}
              </Text>
              {!readOnly && (
                <TouchableOpacity style={styles.deleteRow} onPress={() => remove(m)}>
                  <Ionicons name="trash-outline" size={14} color={theme.spend} />
                  <Text style={styles.deleteText}>Excluir</Text>
                </TouchableOpacity>
              )}
            </TouchableOpacity>
          );
        })}

        <Text style={[styles.sectionTitle, { marginTop: 20 }]}>Histórico</Text>
        {done.length === 0 ? (
          <Text style={styles.emptyLine}>Nenhuma manutenção registrada.</Text>
        ) : done.map(m => (
          <TouchableOpacity key={m.id} style={styles.card} activeOpacity={0.7} onPress={() => openEdit(m)}>
            <View style={styles.cardHead}>
              <Text style={styles.cardTitle} numberOfLines={2}>{m.description}</Text>
              <Text style={styles.cardTotal}>{formatBRL(m.totalValue)}</Text>
            </View>
            <View style={styles.detailRows}>
              {m.itemValue > 0 && <Detail label="Item" value={formatBRL(m.itemValue)} theme={theme} />}
              {m.laborValue > 0 && <Detail label="Mão de obra" value={formatBRL(m.laborValue)} theme={theme} />}
              {m.serviceDate != null && <Detail label="Data" value={formatDate(m.serviceDate)} theme={theme} />}
              {m.kmAtService != null && <Detail label="Km" value={`${m.kmAtService.toLocaleString('pt-BR')} km`} theme={theme} />}
              {m.itemPurchaseDate != null && <Detail label="Compra do item" value={formatDate(m.itemPurchaseDate)} theme={theme} />}
            </View>
            {!readOnly && (
              <TouchableOpacity style={styles.deleteRow} onPress={() => remove(m)}>
                <Ionicons name="trash-outline" size={14} color={theme.spend} />
                <Text style={styles.deleteText}>Excluir</Text>
              </TouchableOpacity>
            )}
          </TouchableOpacity>
        ))}
      </ScrollView>

      {!readOnly && (
        <TouchableOpacity style={[styles.fab, { bottom: TAB_BAR_BOTTOM_OFFSET + 16 }]} onPress={openNew} activeOpacity={0.85}>
          <Ionicons name="add" size={30} color="#000" />
        </TouchableOpacity>
      )}

      <AddMaintenanceSheet
        visible={showSheet}
        financingId={financingId}
        currentKm={currentKm}
        existing={editing}
        onClose={() => setShowSheet(false)}
        onSaved={() => { setShowSheet(false); load(); }}
      />
    </View>
  );
};

const Detail: React.FC<{ label: string; value: string; theme: Theme }> = ({ label, value, theme }) => (
  <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3 }}>
    <Text style={{ fontSize: 13, color: theme.textSecondary }}>{label}</Text>
    <Text style={{ fontSize: 13, fontWeight: '600', color: theme.text }}>{value}</Text>
  </View>
);

const makeStyles = (theme: Theme) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.bg },
  center: { alignItems: 'center', justifyContent: 'center' },
  sectionTitle: { fontSize: 20, fontWeight: '900', color: theme.text, marginHorizontal: 16, marginBottom: 10 },
  emptyLine: { fontSize: 14, color: theme.textSecondary, marginHorizontal: 20, marginBottom: 8 },
  card: { marginHorizontal: 16, marginBottom: 10, backgroundColor: theme.card, borderRadius: 16, padding: 16, ...theme.shadow },
  cardHead: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 },
  cardTitle: { flex: 1, fontSize: 15, fontWeight: '700', color: theme.text },
  cardTotal: { fontSize: 16, fontWeight: '900', color: theme.text },
  cardMeta: { fontSize: 13, color: theme.textSecondary, marginTop: 6 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  badgeText: { fontSize: 12, fontWeight: '700' },
  detailRows: { marginTop: 8 },
  deleteRow: { flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start', marginTop: 10 },
  deleteText: { fontSize: 13, fontWeight: '600', color: theme.spend },
  fab: {
    position: 'absolute', right: 20, width: 58, height: 58, borderRadius: 29,
    backgroundColor: theme.accent, alignItems: 'center', justifyContent: 'center', ...theme.shadowLg,
  },
});
