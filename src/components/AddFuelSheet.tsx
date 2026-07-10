import React, { useEffect, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, Modal, ScrollView, TextInput, TouchableOpacity,
  ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, Theme, formatBRL } from '../theme';
import { useResponsive } from '../hooks/useResponsive';
import { fuelService } from '../services/fuelService';
import { CurrencyInput } from './CurrencyInput';
import { parseDate } from '../utils/date';
import { showAlert } from '../utils/dialogs';

interface Props {
  visible: boolean;
  financingId: string;
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

export const AddFuelSheet: React.FC<Props> = ({ visible, financingId, onClose, onSaved }) => {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const { contentStyle } = useResponsive();
  const [station, setStation] = useState('');
  const [dateText, setDateText] = useState('');
  const [cents, setCents] = useState(0);
  const [litersText, setLitersText] = useState('');
  const [kmDrivenText, setKmDrivenText] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (visible) { setStation(''); setDateText(''); setCents(0); setLitersText(''); setKmDrivenText(''); }
  }, [visible]);

  const liters = parseFloat(litersText.replace(',', '.')) || 0;
  const kmDriven = parseInt(kmDrivenText.replace(/\D/g, ''), 10) || 0;
  const pricePerLiter = liters > 0 ? cents / 100 / liters : 0;
  const consumption = liters > 0 && kmDriven > 0 ? kmDriven / liters : 0;

  const save = async () => {
    if (cents <= 0) { showAlert('Erro', 'Informe o valor do abastecimento.'); return; }
    setSaving(true);
    try {
      await fuelService.create(financingId, {
        station: station.trim() || null,
        date: parseDate(dateText),
        totalValue: cents / 100,
        liters: liters || null,
        km: null,
        kmDriven: kmDriven || null,
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
          <View style={styles.note}>
            <Ionicons name="information-circle-outline" size={18} color={theme.accentDark} />
            <Text style={styles.noteText}>
              Informe <Text style={styles.noteBold}>quantos km rodou desde o último tanque cheio</Text> para calcular o consumo (km/L). Sem isso, o abastecimento é salvo, mas não entra na média.
            </Text>
          </View>

          <View style={styles.card}>
            <TextInput style={styles.input} value={station} onChangeText={setStation} placeholder="Nome do posto" placeholderTextColor={theme.textSecondary} />
            <View style={styles.sep} />
            <View style={styles.fieldRow}><Text style={styles.fieldLabel}>Valor pago *</Text><CurrencyInput cents={cents} onChange={setCents} /></View>
            <View style={styles.sep} />
            <View style={styles.fieldRow}>
              <Text style={styles.fieldLabel}>Litros</Text>
              <TextInput style={styles.inlineInput} value={litersText} onChangeText={setLitersText} keyboardType="decimal-pad" placeholder="0" placeholderTextColor={theme.textTertiary} />
            </View>
            <View style={styles.sep} />
            <View style={styles.fieldRow}>
              <Text style={styles.fieldLabel}>Preço do litro</Text>
              <Text style={styles.computed}>{pricePerLiter > 0 ? `${formatBRL(pricePerLiter)}/L` : '—'}</Text>
            </View>
          </View>

          <Text style={styles.sectionHeader}>CONSUMO</Text>
          <View style={styles.card}>
            <View style={styles.fieldRow}>
              <Text style={styles.fieldLabel}>Km rodados no tanque</Text>
              <TextInput style={styles.inlineInput} value={kmDrivenText} onChangeText={t => setKmDrivenText(groupKm(t))} keyboardType="numeric" placeholder="opcional" placeholderTextColor={theme.textTertiary} />
            </View>
            <View style={styles.sep} />
            <View style={styles.fieldRow}>
              <Text style={styles.fieldLabel}>Consumo</Text>
              <Text style={styles.computed}>{consumption > 0 ? `${consumption.toFixed(1)} km/L` : '—'}</Text>
            </View>
          </View>

          <View style={styles.card}>
            <View style={styles.fieldRow}>
              <Text style={styles.fieldLabel}>Data</Text>
              <TextInput style={styles.inlineInput} value={dateText} onChangeText={t => setDateText(dateMask(t))} keyboardType="numeric" placeholder="dd/mm/aaaa" placeholderTextColor={theme.textTertiary} maxLength={10} />
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
  note: { flexDirection: 'row', gap: 8, backgroundColor: theme.accentSubtle, borderRadius: 12, padding: 12 },
  noteText: { flex: 1, fontSize: 13, color: theme.text, lineHeight: 18 },
  noteBold: { fontWeight: '700' },
  card: { backgroundColor: theme.card, borderRadius: 16, overflow: 'hidden', ...theme.shadow },
  input: { fontSize: 16, color: theme.text, paddingHorizontal: 16, paddingVertical: 14 },
  sep: { height: StyleSheet.hairlineWidth, backgroundColor: theme.separator, marginHorizontal: 16 },
  sectionHeader: { fontSize: 12, fontWeight: '700', color: theme.textSecondary, marginTop: 4, marginBottom: -4, letterSpacing: 0.5 },
  fieldRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, gap: 12 },
  fieldLabel: { fontSize: 14, color: theme.text, fontWeight: '500' },
  inlineInput: { fontSize: 16, color: theme.text, paddingVertical: 14, minWidth: 120, textAlign: 'right' },
  computed: { fontSize: 16, fontWeight: '700', color: theme.accentDark, paddingVertical: 14 },
  saveBtn: { backgroundColor: theme.accent, borderRadius: 16, paddingVertical: 16, alignItems: 'center', marginTop: 8, ...theme.shadowMd },
  saveBtnText: { fontSize: 16, fontWeight: '800', color: '#000' },
});
