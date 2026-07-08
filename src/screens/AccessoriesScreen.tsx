import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useTheme, Theme, formatBRL } from '../theme';
import { useResponsive } from '../hooks/useResponsive';
import { useCar } from '../contexts/CarContext';
import { Accessory, WishlistItem } from '../types';
import { accessoryService } from '../services/accessoryService';
import { wishlistService } from '../services/wishlistService';
import { AddAccessorySheet } from '../components/AddAccessorySheet';
import { AddWishlistSheet } from '../components/AddWishlistSheet';
import { TAB_BAR_BOTTOM_OFFSET } from '../navigation';
import { formatDate } from '../utils/date';
import { showConfirm, showAlert } from '../utils/dialogs';

type Tab = 'installed' | 'wishlist';
const PRIORITY_LABELS = ['Baixa', 'Média', 'Alta'];

export const AccessoriesScreen: React.FC = () => {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const { contentStyle } = useResponsive();
  const { financingId, readOnly } = useCar();
  const [tab, setTab] = useState<Tab>('installed');
  const [installed, setInstalled] = useState<Accessory[]>([]);
  const [wishlist, setWishlist] = useState<WishlistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAccSheet, setShowAccSheet] = useState(false);
  const [showWishSheet, setShowWishSheet] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([accessoryService.listByCar(financingId), wishlistService.listByCar(financingId)])
      .then(([a, w]) => { setInstalled(a); setWishlist(w); })
      .catch(() => null)
      .finally(() => setLoading(false));
  }, [financingId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const removeAcc = (a: Accessory) => {
    showConfirm('Excluir acessório?', `"${a.name}" será removido.`, 'Excluir', async () => {
      try { await accessoryService.remove(a.id); load(); } catch (e: any) { showAlert('Erro', e?.message ?? 'Tente novamente'); }
    });
  };
  const removeWish = (w: WishlistItem) => {
    showConfirm('Remover da lista?', `"${w.name}" será removido.`, 'Remover', async () => {
      try { await wishlistService.remove(w.id); load(); } catch (e: any) { showAlert('Erro', e?.message ?? 'Tente novamente'); }
    });
  };

  if (loading) {
    return <View style={[styles.container, styles.center]}><ActivityIndicator size="large" color={theme.accentDark} /></View>;
  }

  const installedTotal = installed.reduce((s, a) => s + a.value, 0);

  return (
    <View style={styles.container}>
      <View style={styles.segmentWrap}>
        <View style={styles.segment}>
          <TouchableOpacity style={[styles.segmentBtn, tab === 'installed' && styles.segmentBtnActive]} onPress={() => setTab('installed')}>
            <Text style={[styles.segmentText, tab === 'installed' && styles.segmentTextActive]}>Instalados</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.segmentBtn, tab === 'wishlist' && styles.segmentBtnActive]} onPress={() => setTab('wishlist')}>
            <Text style={[styles.segmentText, tab === 'wishlist' && styles.segmentTextActive]}>Quero colocar</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView contentContainerStyle={[{ paddingBottom: TAB_BAR_BOTTOM_OFFSET + 80 }, contentStyle]}>
        {tab === 'installed' ? (
          installed.length === 0 ? (
            <Text style={styles.emptyLine}>Nenhum acessório instalado.</Text>
          ) : (
            <>
              {installed.map(a => (
                <View key={a.id} style={styles.row}>
                  <View style={styles.bullet} />
                  <View style={styles.rowBody}>
                    <Text style={styles.rowName}>{a.name}</Text>
                    {a.date != null && <Text style={styles.rowMeta}>{formatDate(a.date)}</Text>}
                  </View>
                  <Text style={styles.rowValue}>{formatBRL(a.value)}</Text>
                  {!readOnly && (
                    <TouchableOpacity onPress={() => removeAcc(a)} style={styles.removeBtn}>
                      <Ionicons name="close-circle" size={18} color={theme.textSecondary} />
                    </TouchableOpacity>
                  )}
                </View>
              ))}
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Total instalado</Text>
                <Text style={styles.totalValue}>{formatBRL(installedTotal)}</Text>
              </View>
            </>
          )
        ) : (
          wishlist.length === 0 ? (
            <Text style={styles.emptyLine}>Nenhum acessório na lista de desejos.</Text>
          ) : wishlist.map(w => (
            <View key={w.id} style={styles.card}>
              <View style={styles.cardHead}>
                <Text style={styles.rowName}>{w.name}</Text>
                {w.estimatedValue > 0 && <Text style={styles.rowValue}>{formatBRL(w.estimatedValue)}</Text>}
              </View>
              <View style={styles.cardMetaRow}>
                <View style={[styles.priorityBadge, { backgroundColor: theme.accentSubtle }]}>
                  <Text style={styles.priorityText}>{PRIORITY_LABELS[w.priority] ?? 'Baixa'}</Text>
                </View>
                {!readOnly && (
                  <TouchableOpacity onPress={() => removeWish(w)} style={styles.removeBtn}>
                    <Ionicons name="close-circle" size={18} color={theme.textSecondary} />
                  </TouchableOpacity>
                )}
              </View>
              {w.notes ? <Text style={styles.notes}>{w.notes}</Text> : null}
            </View>
          ))
        )}
      </ScrollView>

      {!readOnly && (
        <TouchableOpacity
          style={[styles.fab, { bottom: TAB_BAR_BOTTOM_OFFSET + 16 }]}
          onPress={() => (tab === 'installed' ? setShowAccSheet(true) : setShowWishSheet(true))}
          activeOpacity={0.85}
        >
          <Ionicons name="add" size={30} color="#000" />
        </TouchableOpacity>
      )}

      <AddAccessorySheet visible={showAccSheet} financingId={financingId} onClose={() => setShowAccSheet(false)} onSaved={() => { setShowAccSheet(false); load(); }} />
      <AddWishlistSheet visible={showWishSheet} financingId={financingId} onClose={() => setShowWishSheet(false)} onSaved={() => { setShowWishSheet(false); load(); }} />
    </View>
  );
};

const makeStyles = (theme: Theme) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.bg },
  center: { alignItems: 'center', justifyContent: 'center' },
  segmentWrap: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4 },
  segment: { flexDirection: 'row', backgroundColor: theme.separator, borderRadius: 12, padding: 3 },
  segmentBtn: { flex: 1, paddingVertical: 9, borderRadius: 9, alignItems: 'center' },
  segmentBtnActive: { backgroundColor: theme.card, ...theme.shadow },
  segmentText: { fontSize: 14, fontWeight: '600', color: theme.textSecondary },
  segmentTextActive: { color: theme.text, fontWeight: '800' },
  emptyLine: { fontSize: 14, color: theme.textSecondary, marginHorizontal: 20, marginTop: 16 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, marginHorizontal: 16, marginTop: 10, backgroundColor: theme.card, borderRadius: 14, padding: 14, ...theme.shadow },
  bullet: { width: 8, height: 8, borderRadius: 4, backgroundColor: theme.accentDark },
  rowBody: { flex: 1, gap: 2 },
  rowName: { fontSize: 15, fontWeight: '700', color: theme.text },
  rowMeta: { fontSize: 12, color: theme.textSecondary },
  rowValue: { fontSize: 15, fontWeight: '800', color: theme.text },
  removeBtn: { padding: 2 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', marginHorizontal: 16, marginTop: 14, paddingHorizontal: 4 },
  totalLabel: { fontSize: 14, fontWeight: '700', color: theme.textSecondary },
  totalValue: { fontSize: 16, fontWeight: '900', color: theme.text },
  card: { marginHorizontal: 16, marginTop: 10, backgroundColor: theme.card, borderRadius: 16, padding: 16, ...theme.shadow },
  cardHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 },
  cardMetaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 },
  priorityBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  priorityText: { fontSize: 12, fontWeight: '700', color: theme.accentDark },
  notes: { fontSize: 13, color: theme.textSecondary, marginTop: 8 },
  fab: {
    position: 'absolute', right: 20, width: 58, height: 58, borderRadius: 29,
    backgroundColor: theme.accent, alignItems: 'center', justifyContent: 'center', ...theme.shadowLg,
  },
});
