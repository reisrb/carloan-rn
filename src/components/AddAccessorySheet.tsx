import React, { useEffect, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, Modal, ScrollView, TextInput, TouchableOpacity,
  ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, Theme } from '../theme';
import { useResponsive } from '../hooks/useResponsive';
import { accessoryService } from '../services/accessoryService';
import { CurrencyInput } from './CurrencyInput';
import { parseDate } from '../utils/date';
import { showAlert } from '../utils/dialogs';

interface Props {
  visible: boolean;
  financingId: string;
  onClose: () => void;
  onSaved: () => void;
}

const dateMask = (text: string): string => {
  const d = text.replace(/\D/g, '').slice(0, 8);
  if (d.length > 4) return `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}`;
  if (d.length > 2) return `${d.slice(0, 2)}/${d.slice(2)}`;
  return d;
};

export const AddAccessorySheet: React.FC<Props> = ({ visible, financingId, onClose, onSaved }) => {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const { contentStyle } = useResponsive();
  const [name, setName] = useState('');
  const [cents, setCents] = useState(0);
  const [dateText, setDateText] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (visible) { setName(''); setCents(0); setDateText(''); } }, [visible]);

  const save = async () => {
    if (!name.trim()) { showAlert('Erro', 'Informe o nome do acessório.'); return; }
    setSaving(true);
    try {
      await accessoryService.create(financingId, { name: name.trim(), value: cents / 100, date: parseDate(dateText) });
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
          <Text style={styles.headerTitle}>Novo acessório</Text>
          <TouchableOpacity onPress={onClose}><Ionicons name="close" size={24} color={theme.textSecondary} /></TouchableOpacity>
        </View>
        <ScrollView contentContainerStyle={[styles.body, contentStyle]} keyboardShouldPersistTaps="handled">
          <View style={styles.card}>
            <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Nome do acessório *" placeholderTextColor={theme.textSecondary} />
            <View style={styles.sep} />
            <View style={styles.fieldRow}><Text style={styles.fieldLabel}>Valor</Text><CurrencyInput cents={cents} onChange={setCents} /></View>
            <View style={styles.sep} />
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
  card: { backgroundColor: theme.card, borderRadius: 16, overflow: 'hidden', ...theme.shadow },
  input: { fontSize: 16, color: theme.text, paddingHorizontal: 16, paddingVertical: 14 },
  sep: { height: StyleSheet.hairlineWidth, backgroundColor: theme.separator, marginHorizontal: 16 },
  fieldRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, gap: 12 },
  fieldLabel: { fontSize: 14, color: theme.text, fontWeight: '500' },
  inlineInput: { fontSize: 16, color: theme.text, paddingVertical: 14, minWidth: 120, textAlign: 'right' },
  saveBtn: { backgroundColor: theme.accent, borderRadius: 16, paddingVertical: 16, alignItems: 'center', marginTop: 8, ...theme.shadowMd },
  saveBtnText: { fontSize: 16, fontWeight: '800', color: '#000' },
});
