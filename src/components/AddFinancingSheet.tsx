import React, { useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, Modal, ScrollView, TextInput, TouchableOpacity,
  ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, Theme, formatBRL } from '../theme';
import { useResponsive } from '../hooks/useResponsive';
import { financingService } from '../services/financingService';
import { CurrencyInput } from './CurrencyInput';
import { parseDate } from '../utils/date';
import { showAlert } from '../utils/dialogs';

interface Props {
  visible: boolean;
  financingId: string;
  onClose: () => void;
  onSaved: () => void;
}

export const AddFinancingSheet: React.FC<Props> = ({ visible, financingId, onClose, onSaved }) => {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const { contentStyle } = useResponsive();

  const [bank, setBank] = useState('');
  const [vehicleCents, setVehicleCents] = useState(0);
  const [installmentCents, setInstallmentCents] = useState(0);
  const [totalText, setTotalText] = useState('');
  const [alreadyPaid, setAlreadyPaid] = useState(0);
  const [dueDateText, setDueDateText] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [downCents, setDownCents] = useState(0);
  const [rateText, setRateText] = useState('');
  const [saving, setSaving] = useState(false);

  const total = parseInt(totalText, 10) || 0;
  const installmentValue = installmentCents / 100;
  const totalCost = installmentValue * total;
  const paidAmount = installmentValue * alreadyPaid;

  const reset = () => {
    setBank(''); setVehicleCents(0); setInstallmentCents(0); setTotalText('');
    setAlreadyPaid(0); setDueDateText(''); setShowAdvanced(false); setDownCents(0); setRateText('');
  };

  const handleDateChange = (text: string) => {
    const digits = text.replace(/\D/g, '').slice(0, 8);
    let formatted = digits;
    if (digits.length > 4) formatted = `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
    else if (digits.length > 2) formatted = `${digits.slice(0, 2)}/${digits.slice(2)}`;
    setDueDateText(formatted);
  };

  const save = async () => {
    const firstDueDate = parseDate(dueDateText);
    const rate = parseFloat(rateText.replace(',', '.')) || 0;

    if (installmentCents <= 0) { showAlert('Erro', 'Informe o valor da parcela.'); return; }
    if (total <= 0) { showAlert('Erro', 'Informe o total de parcelas.'); return; }
    if (alreadyPaid > total) { showAlert('Erro', 'Parcelas pagas não pode exceder o total.'); return; }
    if (!firstDueDate) { showAlert('Erro', 'Data do primeiro vencimento inválida. Use dd/mm/aaaa.'); return; }

    setSaving(true);
    try {
      await financingService.addFinancing(financingId, {
        bank: bank.trim(),
        vehicleValue: vehicleCents / 100,
        downPayment: downCents / 100,
        monthlyRate: rate / 100,
        installmentAmount: installmentValue,
        totalInstallments: total,
        firstDueDate,
        alreadyPaidCount: alreadyPaid,
      });
      reset();
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
          <Text style={styles.headerTitle}>Adicionar financiamento</Text>
          <TouchableOpacity onPress={() => { reset(); onClose(); }}>
            <Ionicons name="close" size={24} color={theme.textSecondary} />
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={[styles.body, contentStyle]} keyboardShouldPersistTaps="handled">
          <View style={styles.card}>
            <TextInput style={styles.input} value={bank} onChangeText={setBank} placeholder="Banco / financeira" placeholderTextColor={theme.textSecondary} />
          </View>

          <Text style={styles.sectionHeader}>VALORES</Text>
          <View style={styles.card}>
            <View style={styles.fieldRow}>
              <Text style={styles.fieldLabel}>Valor do veículo</Text>
              <CurrencyInput cents={vehicleCents} onChange={setVehicleCents} />
            </View>
            <View style={styles.sep} />
            <View style={styles.fieldRow}>
              <Text style={styles.fieldLabel}>Valor da parcela *</Text>
              <CurrencyInput cents={installmentCents} onChange={setInstallmentCents} />
            </View>
            <View style={styles.sep} />
            <View style={styles.fieldRow}>
              <Text style={styles.fieldLabel}>Total de parcelas *</Text>
              <TextInput style={styles.inlineInput} value={totalText} onChangeText={t => setTotalText(t.replace(/\D/g, '').slice(0, 3))} keyboardType="numeric" placeholder="48" placeholderTextColor={theme.textTertiary} />
            </View>
            <View style={styles.sep} />
            <View style={styles.fieldRow}>
              <Text style={styles.fieldLabel}>Parcelas já pagas</Text>
              <View style={styles.stepper}>
                <TouchableOpacity style={styles.stepBtn} onPress={() => setAlreadyPaid(v => Math.max(0, v - 1))}>
                  <Ionicons name="remove" size={18} color={theme.accentDark} />
                </TouchableOpacity>
                <Text style={styles.stepValue}>{alreadyPaid}</Text>
                <TouchableOpacity style={styles.stepBtn} onPress={() => setAlreadyPaid(v => Math.min(total || 999, v + 1))}>
                  <Ionicons name="add" size={18} color={theme.accentDark} />
                </TouchableOpacity>
              </View>
            </View>
            <View style={styles.sep} />
            <View style={styles.fieldRow}>
              <Text style={styles.fieldLabel}>1º vencimento *</Text>
              <TextInput style={styles.inlineInput} value={dueDateText} onChangeText={handleDateChange} keyboardType="numeric" placeholder="dd/mm/aaaa" placeholderTextColor={theme.textTertiary} maxLength={10} />
            </View>
          </View>

          {totalCost > 0 && (
            <View style={[styles.card, styles.summary]}>
              <SummaryRow label="Custo total" value={formatBRL(totalCost)} theme={theme} />
              {paidAmount > 0 && <SummaryRow label="Já pago" value={formatBRL(paidAmount)} theme={theme} color="#22C55E" />}
              <SummaryRow label="Restante" value={formatBRL(totalCost - paidAmount)} theme={theme} color={theme.orange} />
            </View>
          )}

          <TouchableOpacity style={styles.advancedToggle} onPress={() => setShowAdvanced(v => !v)}>
            <Text style={styles.advancedText}>Avançado (entrada e juros)</Text>
            <Ionicons name={showAdvanced ? 'chevron-up' : 'chevron-down'} size={16} color={theme.accentDark} />
          </TouchableOpacity>

          {showAdvanced && (
            <View style={styles.card}>
              <View style={styles.fieldRow}>
                <Text style={styles.fieldLabel}>Entrada</Text>
                <CurrencyInput cents={downCents} onChange={setDownCents} />
              </View>
              <View style={styles.sep} />
              <View style={styles.fieldRow}>
                <Text style={styles.fieldLabel}>Taxa mensal (%)</Text>
                <TextInput style={styles.inlineInput} value={rateText} onChangeText={setRateText} keyboardType="decimal-pad" placeholder="0 = sem juros" placeholderTextColor={theme.textTertiary} />
              </View>
            </View>
          )}

          <TouchableOpacity style={[styles.saveBtn, saving && { opacity: 0.6 }]} onPress={save} disabled={saving}>
            {saving ? <ActivityIndicator color="#000" /> : <Text style={styles.saveBtnText}>Salvar financiamento</Text>}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const SummaryRow: React.FC<{ label: string; value: string; theme: Theme; color?: string }> = ({ label, value, theme, color }) => (
  <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 }}>
    <Text style={{ fontSize: 14, color: theme.textSecondary }}>{label}</Text>
    <Text style={{ fontSize: 14, fontWeight: '700', color: color ?? theme.text }}>{value}</Text>
  </View>
);

const makeStyles = (theme: Theme) => StyleSheet.create({
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: 16, paddingTop: 20, backgroundColor: theme.card,
    borderBottomWidth: StyleSheet.hairlineWidth, borderColor: theme.border,
  },
  headerTitle: { fontSize: 17, fontWeight: '800', color: theme.text },
  body: { padding: 16, gap: 12, paddingBottom: 40 },
  card: { backgroundColor: theme.card, borderRadius: 16, overflow: 'hidden', ...theme.shadow },
  input: { fontSize: 16, color: theme.text, paddingHorizontal: 16, paddingVertical: 14 },
  sep: { height: StyleSheet.hairlineWidth, backgroundColor: theme.separator, marginHorizontal: 16 },
  sectionHeader: { fontSize: 12, fontWeight: '700', color: theme.textSecondary, marginTop: 8, marginBottom: -4, letterSpacing: 0.5 },
  fieldRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, gap: 12 },
  fieldLabel: { fontSize: 14, color: theme.text, fontWeight: '500' },
  inlineInput: { fontSize: 16, color: theme.text, paddingVertical: 14, minWidth: 110, textAlign: 'right' },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 10 },
  stepBtn: { width: 30, height: 30, borderRadius: 15, backgroundColor: theme.accentSubtle, alignItems: 'center', justifyContent: 'center' },
  stepValue: { fontSize: 16, fontWeight: '700', color: theme.text, minWidth: 24, textAlign: 'center' },
  summary: { padding: 16 },
  advancedToggle: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 4 },
  advancedText: { fontSize: 14, fontWeight: '600', color: theme.accentDark },
  saveBtn: { backgroundColor: theme.accent, borderRadius: 16, paddingVertical: 16, alignItems: 'center', marginTop: 8, ...theme.shadowMd },
  saveBtnText: { fontSize: 16, fontWeight: '800', color: '#000' },
});
