import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { exportHtmlAsPdf } from '../utils/pdf';
import { useTheme, Theme, formatBRL } from '../theme';
import { useResponsive } from '../hooks/useResponsive';
import { useCar } from '../contexts/CarContext';
import { Maintenance } from '../types';
import { maintenanceService } from '../services/maintenanceService';
import { AddMaintenanceSheet } from '../components/AddMaintenanceSheet';
import { ReceiptThumb } from '../components/ReceiptThumb';
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

  const buildHtml = (pending: Maintenance[], done: Maintenance[]): string => {
    const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

    const pendingRows = pending.map(m => {
      const b = pendingBadge(m);
      const prev = [m.dueKm != null ? `${m.dueKm.toLocaleString('pt-BR')} km` : null, m.dueDate != null ? formatDate(m.dueDate) : null].filter(Boolean).join(' · ') || '—';
      return `<tr><td>${esc(m.description)}</td><td>${prev}</td><td style="color:${b.color};font-weight:bold;">${b.label}</td></tr>`;
    }).join('');

    const doneBlocks = done.map(m => {
      const itemRows = m.items.map(it => `<tr><td>• ${esc(it.name)}</td><td class="r">${formatBRL(it.value)}</td></tr>`).join('');
      const meta = [
        m.serviceDate != null ? `Data: ${formatDate(m.serviceDate)}` : null,
        m.kmAtService != null ? `${m.kmAtService.toLocaleString('pt-BR')} km` : null,
        m.itemPurchaseDate != null ? `Compra: ${formatDate(m.itemPurchaseDate)}` : null,
      ].filter(Boolean).join(' &nbsp;·&nbsp; ');
      return `
        <div class="block">
          <div class="bhead"><span class="btitle">${esc(m.description)}</span><span class="btotal">${formatBRL(m.totalValue)}</span></div>
          ${meta ? `<div class="meta">${meta}</div>` : ''}
          <table class="items">
            ${itemRows}
            ${m.laborValue > 0 ? `<tr><td>Mão de obra</td><td class="r">${formatBRL(m.laborValue)}</td></tr>` : ''}
            <tr class="ttl"><td>Total</td><td class="r">${formatBRL(m.totalValue)}</td></tr>
          </table>
        </div>`;
    }).join('');

    const grandTotal = done.reduce((s, m) => s + m.totalValue, 0);

    return `<!DOCTYPE html><html><head><meta charset="utf-8"/><style>
      body{font-family:Arial,sans-serif;margin:24px;color:#000;}
      h1{font-size:22px;margin:0 0 2px 0;} h2{font-size:13px;text-transform:uppercase;color:#666;margin:22px 0 8px;}
      .sub{color:#888;font-size:12px;margin-bottom:8px;}
      table{width:100%;border-collapse:collapse;} th{background:#f5f5f5;text-align:left;padding:8px;font-size:11px;color:#666;}
      td{padding:7px 8px;border-bottom:1px solid #eee;font-size:13px;} .r{text-align:right;font-weight:bold;}
      .block{border:1px solid #eee;border-radius:10px;padding:12px 14px;margin-bottom:10px;}
      .bhead{display:flex;justify-content:space-between;align-items:baseline;} .btitle{font-weight:bold;font-size:15px;} .btotal{font-weight:bold;font-size:15px;}
      .meta{color:#888;font-size:12px;margin:2px 0 8px;} .items td{border:none;padding:3px 0;} .items .ttl td{border-top:1px solid #eee;padding-top:6px;font-weight:bold;}
      .grand{display:flex;justify-content:space-between;font-weight:bold;font-size:15px;margin-top:8px;padding:10px 14px;background:#f5f5f5;border-radius:10px;}
    </style></head><body>
      <h1>${esc(car?.carName ?? 'Carro')}</h1>
      <div class="sub">${car ? esc([[car.brand, car.model].filter(Boolean).join(' '), car.licensePlate, `${car.currentKm.toLocaleString('pt-BR')} km`].filter(Boolean).join(' · ')) : 'Manutenções'}</div>
      ${pending.length ? `<h2>Pendentes</h2><table><thead><tr><th>Descrição</th><th>Previsão</th><th>Status</th></tr></thead><tbody>${pendingRows}</tbody></table>` : ''}
      ${done.length ? `<h2>Histórico</h2>${doneBlocks}<div class="grand"><span>Total gasto em manutenção</span><span>${formatBRL(grandTotal)}</span></div>` : ''}
      ${!pending.length && !done.length ? '<p>Nenhuma manutenção registrada.</p>' : ''}
    </body></html>`;
  };

  const exportPdf = async () => {
    try {
      const html = buildHtml(items.filter(m => m.status === 'pending'), items.filter(m => m.status === 'done'));
      await exportHtmlAsPdf(html, `Manutenções — ${car?.carName ?? 'Carro'}`);
    } catch (e: any) {
      showAlert('Erro', e?.message ?? 'Não foi possível exportar');
    }
  };

  if (loading) {
    return <View style={[styles.container, styles.center]}><ActivityIndicator size="large" color={theme.accentDark} /></View>;
  }

  const pending = items.filter(m => m.status === 'pending');
  const done = items.filter(m => m.status === 'done');

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={[{ paddingTop: 12, paddingBottom: TAB_BAR_BOTTOM_OFFSET + 80 }, contentStyle]}>
        {items.length > 0 && (
          <TouchableOpacity style={styles.exportBtn} onPress={exportPdf} activeOpacity={0.7}>
            <Ionicons name="document-text-outline" size={18} color={theme.accentDark} />
            <Text style={styles.exportText}>Exportar PDF</Text>
          </TouchableOpacity>
        )}
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
            {m.items.length > 0 && (
              <View style={styles.itemsBox}>
                {m.items.map((it, i) => (
                  <View key={i} style={styles.itemLine}>
                    <View style={styles.itemBullet} />
                    <Text style={styles.itemName} numberOfLines={1}>{it.name}</Text>
                    <Text style={styles.itemValue}>{formatBRL(it.value)}</Text>
                  </View>
                ))}
              </View>
            )}
            <View style={styles.detailRows}>
              {m.items.length === 0 && m.itemValue > 0 && <Detail label="Itens" value={formatBRL(m.itemValue)} theme={theme} />}
              {m.laborValue > 0 && <Detail label="Mão de obra" value={formatBRL(m.laborValue)} theme={theme} />}
              {m.serviceDate != null && <Detail label="Data" value={formatDate(m.serviceDate)} theme={theme} />}
              {m.kmAtService != null && <Detail label="Km" value={`${m.kmAtService.toLocaleString('pt-BR')} km`} theme={theme} />}
              {m.itemPurchaseDate != null && <Detail label="Compra do item" value={formatDate(m.itemPurchaseDate)} theme={theme} />}
            </View>
            {m.receiptPaths.length > 0 && (
              <View style={styles.receiptRow}>
                {m.receiptPaths.map(p => <ReceiptThumb key={p} path={p} size={56} openable />)}
              </View>
            )}
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
  exportBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, alignSelf: 'flex-end', marginHorizontal: 16, marginBottom: 12, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 12, backgroundColor: theme.card, ...theme.shadow },
  exportText: { fontSize: 14, fontWeight: '700', color: theme.accentDark },
  emptyLine: { fontSize: 14, color: theme.textSecondary, marginHorizontal: 20, marginBottom: 8 },
  card: { marginHorizontal: 16, marginBottom: 10, backgroundColor: theme.card, borderRadius: 16, padding: 16, ...theme.shadow },
  cardHead: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 },
  cardTitle: { flex: 1, fontSize: 15, fontWeight: '700', color: theme.text },
  cardTotal: { fontSize: 16, fontWeight: '900', color: theme.text },
  cardMeta: { fontSize: 13, color: theme.textSecondary, marginTop: 6 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  badgeText: { fontSize: 12, fontWeight: '700' },
  detailRows: { marginTop: 8 },
  itemsBox: { marginTop: 8, gap: 4 },
  itemLine: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  itemBullet: { width: 5, height: 5, borderRadius: 3, backgroundColor: theme.accentDark },
  itemName: { flex: 1, fontSize: 13, color: theme.text },
  itemValue: { fontSize: 13, fontWeight: '600', color: theme.text },
  receiptRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  deleteRow: { flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start', marginTop: 10 },
  deleteText: { fontSize: 13, fontWeight: '600', color: theme.spend },
  fab: {
    position: 'absolute', right: 20, width: 58, height: 58, borderRadius: 29,
    backgroundColor: theme.accent, alignItems: 'center', justifyContent: 'center', ...theme.shadowLg,
  },
});
