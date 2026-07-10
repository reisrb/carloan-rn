import React, { useEffect, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, Modal, ScrollView, TextInput, TouchableOpacity,
  ActivityIndicator, KeyboardAvoidingView, Platform, Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useTheme, Theme, formatBRL } from '../theme';
import { useResponsive } from '../hooks/useResponsive';
import { Maintenance, MaintenanceStatus } from '../types';
import { maintenanceService } from '../services/maintenanceService';
import { financingService } from '../services/financingService';
import { imageService } from '../services/imageService';
import { ReceiptThumb } from './ReceiptThumb';
import { CurrencyInput } from './CurrencyInput';
import { formatDate, parseDate } from '../utils/date';
import { showAlert, showConfirm } from '../utils/dialogs';

interface Props {
  visible: boolean;
  financingId: string;
  currentKm: number;
  existing: Maintenance | null;
  forceDone?: boolean;
  onClose: () => void;
  onSaved: () => void;
}

// Group an integer km with thousand separators (right-to-left), e.g. "12345" -> "12.345".
const groupKm = (text: string): string => {
  const digits = text.replace(/\D/g, '').slice(0, 7);
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
};

const dateMask = (text: string): string => {
  const digits = text.replace(/\D/g, '').slice(0, 8);
  if (digits.length > 4) return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
  if (digits.length > 2) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return digits;
};

export const AddMaintenanceSheet: React.FC<Props> = ({ visible, financingId, currentKm, existing, forceDone, onClose, onSaved }) => {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const { contentStyle } = useResponsive();

  const [status, setStatus] = useState<MaintenanceStatus>('pending');
  const [description, setDescription] = useState('');
  const [items, setItems] = useState<{ name: string; cents: number }[]>([]);
  const [laborCents, setLaborCents] = useState(0);
  const [totalCents, setTotalCents] = useState(0);
  const [totalTouched, setTotalTouched] = useState(false);
  const [serviceDateText, setServiceDateText] = useState('');
  const [kmText, setKmText] = useState('');
  const [purchaseDateText, setPurchaseDateText] = useState('');
  const [dueKmText, setDueKmText] = useState('');
  const [dueDateText, setDueDateText] = useState('');
  const [existingReceipts, setExistingReceipts] = useState<string[]>([]);
  const [newReceiptUris, setNewReceiptUris] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!visible) return;
    if (existing) {
      setStatus(forceDone ? 'done' : existing.status);
      setDescription(existing.description);
      setTotalCents(Math.round(existing.totalValue * 100));
      setTotalTouched(existing.totalValue !== existing.itemValue + existing.laborValue);
      setItems((existing.items ?? []).map(it => ({ name: it.name, cents: Math.round(it.value * 100) })));
      setLaborCents(Math.round(existing.laborValue * 100));
      setServiceDateText(existing.serviceDate ? formatDate(existing.serviceDate) : '');
      setKmText(groupKm(String(existing.kmAtService != null ? existing.kmAtService : currentKm)));
      setPurchaseDateText(existing.itemPurchaseDate ? formatDate(existing.itemPurchaseDate) : '');
      setDueKmText(existing.dueKm != null ? groupKm(String(existing.dueKm)) : '');
      setDueDateText(existing.dueDate ? formatDate(existing.dueDate) : '');
      setExistingReceipts(existing.receiptPaths ?? []);
      setNewReceiptUris([]);
    } else {
      setStatus('pending'); setDescription(''); setTotalCents(0); setTotalTouched(false); setItems([]); setLaborCents(0);
      setServiceDateText(''); setKmText(groupKm(String(currentKm))); setPurchaseDateText(''); setDueKmText(''); setDueDateText('');
      setExistingReceipts([]); setNewReceiptUris([]);
    }
  }, [visible, existing, currentKm, forceDone]);

  const itemsCents = items.reduce((s, it) => s + it.cents, 0);

  // Auto-fill total from items + labor while the user hasn't overridden it.
  useEffect(() => {
    if (!totalTouched) setTotalCents(itemsCents + laborCents);
  }, [itemsCents, laborCents, totalTouched]);

  const addItem = () => setItems(cur => [...cur, { name: '', cents: 0 }]);
  const updateItem = (idx: number, patch: Partial<{ name: string; cents: number }>) =>
    setItems(cur => cur.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  const removeItem = (idx: number) => setItems(cur => cur.filter((_, i) => i !== idx));

  const pickReceipt = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7 });
    if (!result.canceled && result.assets[0]) setNewReceiptUris(cur => [...cur, result.assets[0].uri]);
  };

  const save = async () => {
    const desc = description.trim();
    if (!desc) { showAlert('Erro', 'Descreva a manutenção.'); return; }

    const kmAtService = status === 'done' ? (parseInt(kmText.replace(/\D/g, ''), 10) || null) : null;

    setSaving(true);
    try {
      const uploaded: string[] = [];
      for (const uri of newReceiptUris) {
        try { uploaded.push(await imageService.uploadReceipt(uri)); } catch { /* best-effort */ }
      }
      const receiptPaths = status === 'done' ? [...existingReceipts, ...uploaded] : [];

      const cleanItems = items
        .filter(it => it.name.trim() || it.cents > 0)
        .map(it => ({ name: it.name.trim() || 'Item', value: it.cents / 100 }));

      const enteredKm = parseInt(dueKmText.replace(/\D/g, ''), 10) || null;
      const dueDate = parseDate(dueDateText);

      const input = {
        status,
        description: desc,
        items: status === 'done' ? cleanItems : [],
        totalValue: status === 'done' ? totalCents / 100 : 0,
        itemValue: status === 'done' ? itemsCents / 100 : 0,
        laborValue: status === 'done' ? laborCents / 100 : 0,
        serviceDate: status === 'done' ? parseDate(serviceDateText) : null,
        kmAtService,
        itemPurchaseDate: status === 'done' ? parseDate(purchaseDateText) : null,
        // Pending: km is the absolute target. Done: validade lives on the spawned pending.
        dueKm: status === 'pending' ? enteredKm : null,
        dueDate: status === 'pending' ? dueDate : null,
        receiptPaths,
      };

      if (existing) await maintenanceService.update(existing.id, input);
      else await maintenanceService.create(financingId, input);

      // Done maintenance with a validade → spawn a pending "next change" card.
      // Validade km is an increment over the service km (or current km).
      if (status === 'done' && (enteredKm != null || dueDate != null)) {
        const base = kmAtService ?? currentKm;
        await maintenanceService.create(financingId, {
          status: 'pending',
          description: desc,
          items: [],
          totalValue: 0,
          itemValue: 0,
          laborValue: 0,
          serviceDate: null,
          kmAtService: null,
          itemPurchaseDate: null,
          dueKm: enteredKm != null ? base + enteredKm : null,
          dueDate,
          receiptPaths: [],
        });
      }

      if (kmAtService != null && kmAtService > currentKm) {
        showConfirm(
          'Atualizar quilometragem?',
          `A manutenção foi feita com ${kmAtService.toLocaleString('pt-BR')} km, maior que o registrado (${currentKm.toLocaleString('pt-BR')} km). Atualizar o km do carro?`,
          'Atualizar',
          () => { financingService.updateKm(financingId, kmAtService).catch(() => null); },
        );
      }
      onSaved();
    } catch (e: any) {
      showAlert('Erro ao salvar', e?.message ?? 'Tente novamente');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1, backgroundColor: theme.bg }}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>{existing ? 'Editar manutenção' : 'Nova manutenção'}</Text>
          <TouchableOpacity onPress={onClose}>
            <Ionicons name="close" size={24} color={theme.textSecondary} />
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={[styles.body, contentStyle]} keyboardShouldPersistTaps="handled">
          <View style={styles.segment}>
            {(['pending', 'done'] as MaintenanceStatus[]).map(s => (
              <TouchableOpacity key={s} style={[styles.segmentBtn, status === s && styles.segmentBtnActive]} onPress={() => setStatus(s)}>
                <Text style={[styles.segmentText, status === s && styles.segmentTextActive]}>{s === 'pending' ? 'Pendente' : 'Feita'}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.card}>
            <TextInput style={styles.input} value={description} onChangeText={setDescription} placeholder="O que foi/será feito *" placeholderTextColor={theme.textSecondary} multiline />
          </View>

          {status === 'done' ? (
            <>
              <Text style={styles.sectionHeader}>ITENS</Text>
              <View style={styles.card}>
                {items.length === 0 && <Text style={styles.itemsEmpty}>Adicione os itens comprados (ex: radiador, líquido).</Text>}
                {items.map((it, idx) => (
                  <View key={idx}>
                    {idx > 0 && <View style={styles.sep} />}
                    <View style={styles.itemRow}>
                      <TextInput
                        style={styles.itemName}
                        value={it.name}
                        onChangeText={t => updateItem(idx, { name: t })}
                        placeholder="Item"
                        placeholderTextColor={theme.textTertiary}
                      />
                      <CurrencyInput cents={it.cents} onChange={c => updateItem(idx, { cents: c })} />
                      <TouchableOpacity onPress={() => removeItem(idx)} style={styles.itemRemove}>
                        <Ionicons name="close-circle" size={20} color={theme.textSecondary} />
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
                <View style={styles.sep} />
                <TouchableOpacity style={styles.addItemRow} onPress={addItem} activeOpacity={0.7}>
                  <Ionicons name="add-circle-outline" size={20} color={theme.accentDark} />
                  <Text style={styles.addItemText}>Adicionar item</Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.sectionHeader}>CUSTOS</Text>
              <View style={styles.card}>
                <View style={styles.fieldRow}><Text style={styles.fieldLabel}>Itens</Text><Text style={styles.readonlyValue}>{formatBRL(itemsCents / 100)}</Text></View>
                <View style={styles.sep} />
                <View style={styles.fieldRow}><Text style={styles.fieldLabel}>Mão de obra</Text><CurrencyInput cents={laborCents} onChange={setLaborCents} /></View>
                <View style={styles.sep} />
                <View style={styles.fieldRow}>
                  <View style={styles.totalLabelWrap}>
                    <Text style={styles.fieldLabel}>Valor total</Text>
                    {totalTouched && (
                      <TouchableOpacity style={styles.rollbackBtn} onPress={() => setTotalTouched(false)} activeOpacity={0.7}>
                        <Ionicons name="arrow-undo-outline" size={13} color={theme.accentDark} />
                        <Text style={styles.rollbackText}>voltar ao cálculo</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                  <CurrencyInput
                    cents={totalCents}
                    onChange={(v) => { if (v === 0) { setTotalTouched(false); } else { setTotalCents(v); setTotalTouched(true); } }}
                  />
                </View>
              </View>

              <Text style={styles.sectionHeader}>DATAS E KM</Text>
              <View style={styles.card}>
                <View style={styles.fieldRow}>
                  <Text style={styles.fieldLabel}>Data do serviço</Text>
                  <TextInput style={styles.inlineInput} value={serviceDateText} onChangeText={t => setServiceDateText(dateMask(t))} keyboardType="numeric" placeholder="dd/mm/aaaa" placeholderTextColor={theme.textTertiary} maxLength={10} />
                </View>
                <View style={styles.sep} />
                <View style={styles.fieldRow}>
                  <Text style={styles.fieldLabel}>Km no serviço</Text>
                  <TextInput style={styles.inlineInput} value={kmText} onChangeText={t => setKmText(groupKm(t))} keyboardType="numeric" placeholder={groupKm(String(currentKm))} placeholderTextColor={theme.textTertiary} />
                </View>
                <View style={styles.sep} />
                <View style={styles.fieldRow}>
                  <Text style={styles.fieldLabel}>Data da compra</Text>
                  <TextInput style={styles.inlineInput} value={purchaseDateText} onChangeText={t => setPurchaseDateText(dateMask(t))} keyboardType="numeric" placeholder="dd/mm/aaaa" placeholderTextColor={theme.textTertiary} maxLength={10} />
                </View>
              </View>

              <Text style={styles.sectionHeader}>PRÓXIMA TROCA (opcional)</Text>
              <View style={styles.card}>
                <View style={styles.fieldRow}>
                  <Text style={styles.fieldLabel}>Rodar mais (km)</Text>
                  <TextInput style={styles.inlineInput} value={dueKmText} onChangeText={t => setDueKmText(groupKm(t))} keyboardType="numeric" placeholder="ex: 30.000" placeholderTextColor={theme.textTertiary} />
                </View>
                <View style={styles.sep} />
                <View style={styles.fieldRow}>
                  <Text style={styles.fieldLabel}>Validade (data)</Text>
                  <TextInput style={styles.inlineInput} value={dueDateText} onChangeText={t => setDueDateText(dateMask(t))} keyboardType="numeric" placeholder="dd/mm/aaaa" placeholderTextColor={theme.textTertiary} maxLength={10} />
                </View>
              </View>

              <Text style={styles.sectionHeader}>COMPROVANTE</Text>
              <View style={styles.receipts}>
                {existingReceipts.map(path => (
                  <View key={path} style={styles.receiptItem}>
                    <ReceiptThumb path={path} size={72} />
                    <TouchableOpacity style={styles.receiptRemove} onPress={() => setExistingReceipts(cur => cur.filter(p => p !== path))}>
                      <Ionicons name="close-circle" size={20} color={theme.spend} />
                    </TouchableOpacity>
                  </View>
                ))}
                {newReceiptUris.map((uri, idx) => (
                  <View key={`new-${idx}`} style={styles.receiptItem}>
                    <Image source={{ uri }} style={styles.receiptThumb} />
                    <TouchableOpacity style={styles.receiptRemove} onPress={() => setNewReceiptUris(cur => cur.filter((_, i) => i !== idx))}>
                      <Ionicons name="close-circle" size={20} color={theme.spend} />
                    </TouchableOpacity>
                  </View>
                ))}
                <TouchableOpacity style={styles.receiptAdd} onPress={pickReceipt} activeOpacity={0.7}>
                  <Ionicons name="camera-outline" size={22} color={theme.accentDark} />
                  <Text style={styles.receiptAddText}>Anexar</Text>
                </TouchableOpacity>
              </View>
            </>
          ) : (
            <>
              <Text style={styles.sectionHeader}>PREVISÃO</Text>
              <View style={styles.card}>
                <View style={styles.fieldRow}>
                  <Text style={styles.fieldLabel}>Vence em (km)</Text>
                  <TextInput style={styles.inlineInput} value={dueKmText} onChangeText={t => setDueKmText(groupKm(t))} keyboardType="numeric" placeholder="opcional" placeholderTextColor={theme.textTertiary} />
                </View>
                <View style={styles.sep} />
                <View style={styles.fieldRow}>
                  <Text style={styles.fieldLabel}>Vence em (data)</Text>
                  <TextInput style={styles.inlineInput} value={dueDateText} onChangeText={t => setDueDateText(dateMask(t))} keyboardType="numeric" placeholder="dd/mm/aaaa" placeholderTextColor={theme.textTertiary} maxLength={10} />
                </View>
              </View>
            </>
          )}

          <TouchableOpacity style={[styles.saveBtn, saving && { opacity: 0.6 }]} onPress={save} disabled={saving}>
            {saving ? <ActivityIndicator color="#000" /> : <Text style={styles.saveBtnText}>Salvar</Text>}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const makeStyles = (theme: Theme) => StyleSheet.create({
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: 16, paddingTop: 20, backgroundColor: theme.card,
    borderBottomWidth: StyleSheet.hairlineWidth, borderColor: theme.border,
  },
  headerTitle: { fontSize: 17, fontWeight: '800', color: theme.text },
  body: { padding: 16, gap: 12, paddingBottom: 40 },
  segment: { flexDirection: 'row', backgroundColor: theme.separator, borderRadius: 12, padding: 3 },
  segmentBtn: { flex: 1, paddingVertical: 9, borderRadius: 9, alignItems: 'center' },
  segmentBtnActive: { backgroundColor: theme.card, ...theme.shadow },
  segmentText: { fontSize: 14, fontWeight: '600', color: theme.textSecondary },
  segmentTextActive: { color: theme.text, fontWeight: '800' },
  card: { backgroundColor: theme.card, borderRadius: 16, overflow: 'hidden', ...theme.shadow },
  input: { fontSize: 16, color: theme.text, paddingHorizontal: 16, paddingVertical: 14, minHeight: 48 },
  sep: { height: StyleSheet.hairlineWidth, backgroundColor: theme.separator, marginHorizontal: 16 },
  sectionHeader: { fontSize: 12, fontWeight: '700', color: theme.textSecondary, marginTop: 8, marginBottom: -4, letterSpacing: 0.5 },
  fieldRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, gap: 12 },
  fieldLabel: { fontSize: 14, color: theme.text, fontWeight: '500' },
  totalLabelWrap: { gap: 3 },
  rollbackBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  rollbackText: { fontSize: 12, fontWeight: '600', color: theme.accentDark },
  inlineInput: { fontSize: 16, color: theme.text, paddingVertical: 14, minWidth: 120, textAlign: 'right' },
  readonlyValue: { fontSize: 16, fontWeight: '700', color: theme.textSecondary, paddingVertical: 14 },
  itemsEmpty: { fontSize: 13, color: theme.textSecondary, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 4 },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16 },
  itemName: { flex: 1, fontSize: 16, color: theme.text, paddingVertical: 14 },
  itemRemove: { padding: 2 },
  addItemRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 14 },
  addItemText: { fontSize: 15, fontWeight: '600', color: theme.accentDark },
  receipts: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  receiptItem: { position: 'relative' },
  receiptThumb: { width: 72, height: 72, borderRadius: 12, backgroundColor: theme.separator },
  receiptRemove: { position: 'absolute', top: -6, right: -6, backgroundColor: theme.card, borderRadius: 10 },
  receiptAdd: { width: 72, height: 72, borderRadius: 12, borderWidth: 1.5, borderColor: theme.accentBorder, borderStyle: 'dashed', backgroundColor: theme.accentSubtle, alignItems: 'center', justifyContent: 'center', gap: 2 },
  receiptAddText: { fontSize: 11, fontWeight: '600', color: theme.accentDark },
  saveBtn: { backgroundColor: theme.accent, borderRadius: 16, paddingVertical: 16, alignItems: 'center', marginTop: 8, ...theme.shadowMd },
  saveBtnText: { fontSize: 16, fontWeight: '800', color: '#000' },
});
