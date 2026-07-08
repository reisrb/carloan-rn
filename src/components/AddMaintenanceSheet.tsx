import React, { useEffect, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, Modal, ScrollView, TextInput, TouchableOpacity,
  ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, Theme } from '../theme';
import { useResponsive } from '../hooks/useResponsive';
import { Maintenance, MaintenanceStatus } from '../types';
import { maintenanceService } from '../services/maintenanceService';
import { financingService } from '../services/financingService';
import { CurrencyInput } from './CurrencyInput';
import { formatDate, parseDate } from '../utils/date';
import { showAlert, showConfirm } from '../utils/dialogs';

interface Props {
  visible: boolean;
  financingId: string;
  currentKm: number;
  existing: Maintenance | null;
  onClose: () => void;
  onSaved: () => void;
}

const dateMask = (text: string): string => {
  const digits = text.replace(/\D/g, '').slice(0, 8);
  if (digits.length > 4) return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
  if (digits.length > 2) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return digits;
};

export const AddMaintenanceSheet: React.FC<Props> = ({ visible, financingId, currentKm, existing, onClose, onSaved }) => {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const { contentStyle } = useResponsive();

  const [status, setStatus] = useState<MaintenanceStatus>('pending');
  const [description, setDescription] = useState('');
  const [totalCents, setTotalCents] = useState(0);
  const [itemCents, setItemCents] = useState(0);
  const [laborCents, setLaborCents] = useState(0);
  const [serviceDateText, setServiceDateText] = useState('');
  const [kmText, setKmText] = useState('');
  const [purchaseDateText, setPurchaseDateText] = useState('');
  const [dueKmText, setDueKmText] = useState('');
  const [dueDateText, setDueDateText] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!visible) return;
    if (existing) {
      setStatus(existing.status);
      setDescription(existing.description);
      setTotalCents(Math.round(existing.totalValue * 100));
      setItemCents(Math.round(existing.itemValue * 100));
      setLaborCents(Math.round(existing.laborValue * 100));
      setServiceDateText(existing.serviceDate ? formatDate(existing.serviceDate) : '');
      setKmText(existing.kmAtService != null ? String(existing.kmAtService) : String(currentKm));
      setPurchaseDateText(existing.itemPurchaseDate ? formatDate(existing.itemPurchaseDate) : '');
      setDueKmText(existing.dueKm != null ? String(existing.dueKm) : '');
      setDueDateText(existing.dueDate ? formatDate(existing.dueDate) : '');
    } else {
      setStatus('pending'); setDescription(''); setTotalCents(0); setItemCents(0); setLaborCents(0);
      setServiceDateText(''); setKmText(String(currentKm)); setPurchaseDateText(''); setDueKmText(''); setDueDateText('');
    }
  }, [visible, existing, currentKm]);

  const save = async () => {
    const desc = description.trim();
    if (!desc) { showAlert('Erro', 'Descreva a manutenção.'); return; }

    const kmAtService = status === 'done' ? (parseInt(kmText.replace(/\D/g, ''), 10) || null) : null;

    const input = {
      status,
      description: desc,
      totalValue: status === 'done' ? totalCents / 100 : 0,
      itemValue: status === 'done' ? itemCents / 100 : 0,
      laborValue: status === 'done' ? laborCents / 100 : 0,
      serviceDate: status === 'done' ? parseDate(serviceDateText) : null,
      kmAtService,
      itemPurchaseDate: status === 'done' ? parseDate(purchaseDateText) : null,
      dueKm: status === 'pending' ? (parseInt(dueKmText.replace(/\D/g, ''), 10) || null) : null,
      dueDate: status === 'pending' ? parseDate(dueDateText) : null,
    };

    setSaving(true);
    try {
      if (existing) await maintenanceService.update(existing.id, input);
      else await maintenanceService.create(financingId, input);

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
              <Text style={styles.sectionHeader}>CUSTOS</Text>
              <View style={styles.card}>
                <View style={styles.fieldRow}><Text style={styles.fieldLabel}>Valor total</Text><CurrencyInput cents={totalCents} onChange={setTotalCents} /></View>
                <View style={styles.sep} />
                <View style={styles.fieldRow}><Text style={styles.fieldLabel}>Valor do item</Text><CurrencyInput cents={itemCents} onChange={setItemCents} /></View>
                <View style={styles.sep} />
                <View style={styles.fieldRow}><Text style={styles.fieldLabel}>Mão de obra</Text><CurrencyInput cents={laborCents} onChange={setLaborCents} /></View>
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
                  <TextInput style={styles.inlineInput} value={kmText} onChangeText={t => setKmText(t.replace(/\D/g, '').slice(0, 7))} keyboardType="numeric" placeholder={String(currentKm)} placeholderTextColor={theme.textTertiary} />
                </View>
                <View style={styles.sep} />
                <View style={styles.fieldRow}>
                  <Text style={styles.fieldLabel}>Data da compra</Text>
                  <TextInput style={styles.inlineInput} value={purchaseDateText} onChangeText={t => setPurchaseDateText(dateMask(t))} keyboardType="numeric" placeholder="dd/mm/aaaa" placeholderTextColor={theme.textTertiary} maxLength={10} />
                </View>
              </View>
            </>
          ) : (
            <>
              <Text style={styles.sectionHeader}>PREVISÃO</Text>
              <View style={styles.card}>
                <View style={styles.fieldRow}>
                  <Text style={styles.fieldLabel}>Vence em (km)</Text>
                  <TextInput style={styles.inlineInput} value={dueKmText} onChangeText={t => setDueKmText(t.replace(/\D/g, '').slice(0, 7))} keyboardType="numeric" placeholder="opcional" placeholderTextColor={theme.textTertiary} />
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
  inlineInput: { fontSize: 16, color: theme.text, paddingVertical: 14, minWidth: 120, textAlign: 'right' },
  saveBtn: { backgroundColor: theme.accent, borderRadius: 16, paddingVertical: 16, alignItems: 'center', marginTop: 8, ...theme.shadowMd },
  saveBtnText: { fontSize: 16, fontWeight: '800', color: '#000' },
});
