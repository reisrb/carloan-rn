import React, { useEffect, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, Modal, ScrollView, TextInput, TouchableOpacity,
  ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, Theme } from '../theme';
import { useResponsive } from '../hooks/useResponsive';
import { fuelService } from '../services/fuelService';
import { CurrencyInput } from './CurrencyInput';
import { parseDate } from '../utils/date';
import { showAlert } from '../utils/dialogs';

interface Props {
  visible: boolean;
  financingId: string;
  defaultKm: number;
  onClose: () => void;
  onSaved: () => void;
}

const dateMask = (t: string): string => {
  const d = t.replace(/\D/g, '').slice(0, 8);
  if (d.length > 4) return `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}`;
  if (d.length > 2) return `${d.slice(0, 2)}/${d.slice(2)}`;
  return d;
};
const groupKm = (t: string) => t.replace(/\D/g, '').slice(0, 7).replace(/\B(?=(\d{3})+(?!\d))/g, '.');

export const AddFuelSheet: React.FC<Props> = ({ visible, financingId, defaultKm, onClose, onSaved }) => {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const { contentStyle } = useResponsive();
  const [dateText, setDateText] = useState('');
  const [cents, setCents] = useState(0);
  const [litersText, setLitersText] = useState('');
  const [kmText, setKmText] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (visible) { setDateText(''); setCents(0); setLitersText(''); setKmText(groupKm(String(defaultKm))); }
  }, [visible, defaultKm]);

  const save = async () => {
    if (cents <= 0) { showAlert('Erro', 'Informe o valor do abastecimento.'); return; }
    setSaving(true);
    try {
      await fuelService.create(financingId, {
        date: parseDate(dateText),
        totalValue: cents / 100,
        liters: parseFloat(litersText.replace(',', '.')) || null,
        km: parseInt(kmText.replace(/\D/g, ''), 10) || null,
      });
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
          <Text style={styles.headerTitle}>Novo abastecimento</Text>
          <TouchableOpacity onPress={onClose}><Ionicons name="close" size={24} color={theme.textSecondary} /></TouchableOpacity>
        </View>
        <ScrollView contentContainerStyle={[styles.body, contentStyle]} keyboardShouldPersistTaps="handled">
          <View style={styles.card}>
            <View style={styles.fieldRow}><Text style={styles.fieldLabel}>Valor *</Text><CurrencyInput cents={cents} onChange={setCents} /></View>
            <View style={styles.sep} />
            <View style={styles.fieldRow}>
              <Text style={styles.fieldLabel}>Data</Text>
              <TextInput style={styles.inlineInput} value={dateText} onChangeText={t => setDateText(dateMask(t))} keyboardType="numeric" placeholder="dd/mm/aaaa" placeholderTextColor={theme.textTertiary} maxLength={10} />
            </View>
            <View style={styles.sep} />
            <View style={styles.fieldRow}>
              <Text style={styles.fieldLabel}>Litros</Text>
              <TextInput style={styles.inlineInput} value={litersText} onChangeText={setLitersText} keyboardType="decimal-pad" placeholder="opcional" placeholderTextColor={theme.textTertiary} />
            </View>
            <View style={styles.sep} />
            <View style={styles.fieldRow}>
              <Text style={styles.fieldLabel}>Km</Text>
              <TextInput style={styles.inlineInput} value={kmText} onChangeText={t => setKmText(groupKm(t))} keyboardType="numeric" placeholder="opcional" placeholderTextColor={theme.textTertiary} />
            </View>
          </View>

          <TouchableOpacity style={[styles.saveBtn, saving && { opacity: 0.6 }]} onPress={save} disabled={saving}>
            {saving ? <ActivityIndicator color="#000" /> : <Text style={styles.saveBtnText}>Salvar</Text>}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const makeStyles = (theme: Theme) => StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, paddingTop: 20, backgroundColor: theme.card, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: theme.border },
  headerTitle: { fontSize: 17, fontWeight: '800', color: theme.text },
  body: { padding: 16, gap: 12, paddingBottom: 40 },
  card: { backgroundColor: theme.card, borderRadius: 16, overflow: 'hidden', ...theme.shadow },
  sep: { height: StyleSheet.hairlineWidth, backgroundColor: theme.separator, marginHorizontal: 16 },
  fieldRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, gap: 12 },
  fieldLabel: { fontSize: 14, color: theme.text, fontWeight: '500' },
  inlineInput: { fontSize: 16, color: theme.text, paddingVertical: 14, minWidth: 120, textAlign: 'right' },
  saveBtn: { backgroundColor: theme.accent, borderRadius: 16, paddingVertical: 16, alignItems: 'center', marginTop: 8, ...theme.shadowMd },
  saveBtnText: { fontSize: 16, fontWeight: '800', color: '#000' },
});
