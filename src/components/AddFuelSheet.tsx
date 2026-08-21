import React, { useEffect, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, Modal, ScrollView, TextInput, TouchableOpacity,
  ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, Theme, formatBRL } from '../theme';
import { useResponsive } from '../hooks/useResponsive';
import { fuelService } from '../services/fuelService';
import { FuelFillup } from '../types';
import { CurrencyInput } from './CurrencyInput';
import { formatDate, parseDate } from '../utils/date';
import { showAlert } from '../utils/dialogs';

interface Props {
  visible: boolean;
  financingId: string;
  existing?: FuelFillup | null;
  lastOdometer: number | null;
  onClose: () => void;
  onSaved: () => void;
}

const dateMask = (t: string): string => {
  const d = t.replace(/\D/g, '').slice(0, 8);
  if (d.length > 4) return `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}`;
  if (d.length > 2) return `${d.slice(0, 2)}/${d.slice(2)}`;
  return d;
};
// Right-to-left decimal masks: liters "45,678" (3 dec), km "123.456" (int).
const litersMask = (t: string): string => {
  const d = t.replace(/\D/g, '').slice(0, 6);
  if (!d) return '';
  const p = d.padStart(4, '0');
  const int = p.slice(0, -3).replace(/^0+(?=\d)/, '') || '0';
  return `${int},${p.slice(-3)}`;
};
const kmMask = (t: string): string => {
  const d = t.replace(/\D/g, '').slice(0, 7);
  if (!d) return '';
  return d.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
};
const digitsToNum = (t: string, div: number) => (parseInt(t.replace(/\D/g, '') || '0', 10) || 0) / div;

export const AddFuelSheet: React.FC<Props> = ({ visible, financingId, existing, lastOdometer, onClose, onSaved }) => {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const { contentStyle } = useResponsive();
  const [local, setLocal] = useState('');
  const [flag, setFlag] = useState('');
  const [fuelType, setFuelType] = useState('');
  const [dateText, setDateText] = useState('');
  const [cents, setCents] = useState(0);
  const [litersText, setLitersText] = useState('');
  const [kmText, setKmText] = useState('');
  const [fullTank, setFullTank] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showInfo, setShowInfo] = useState(false);

  useEffect(() => {
    if (!visible) return;
    if (existing) {
      setLocal(existing.local ?? '');
      setFlag(existing.flag ?? '');
      setFuelType(existing.fuelType ?? '');
      setDateText(existing.date != null ? formatDate(existing.date) : '');
      setCents(Math.round(existing.totalValue * 100));
      setLitersText(existing.liters != null ? litersMask(String(Math.round(existing.liters * 1000))) : '');
      setKmText(existing.km != null ? kmMask(String(Math.round(existing.km))) : '');
      setFullTank(existing.fullTank);
    } else {
      setLocal(''); setFlag(''); setFuelType(''); setDateText(''); setCents(0);
      setLitersText(''); setKmText(''); setFullTank(true);
    }
  }, [visible, existing]);

  const liters = digitsToNum(litersText, 1000);
  const km = kmText ? parseInt(kmText.replace(/\D/g, ''), 10) : null;
  const pricePerLiter = liters > 0 ? cents / 100 / liters : 0;

  const save = async () => {
    if (cents <= 0) { showAlert('Erro', 'Informe o valor do abastecimento.'); return; }
    if (km !== null && lastOdometer !== null && km < lastOdometer && (!existing || existing.km !== km)) {
      showAlert('Odômetro inválido', `O odômetro informado é menor que o último registrado (${lastOdometer.toLocaleString('pt-BR')} km). Corrija o valor antes de salvar.`);
      return;
    }
    setSaving(true);
    try {
      const input = {
        local: local.trim() || null,
        flag: flag.trim() || null,
        fuelType: fuelType.trim() || null,
        date: parseDate(dateText),
        totalValue: cents / 100,
        liters: liters || null,
        km,
        kmDriven: existing?.kmDriven ?? null,
        fullTank,
      };
      if (existing) await fuelService.update(existing.id, input);
      else await fuelService.create(financingId, input);
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
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={styles.headerTitle}>{existing ? 'Editar abastecimento' : 'Novo abastecimento'}</Text>
            <TouchableOpacity onPress={() => setShowInfo(true)}>
              <Ionicons name="information-circle-outline" size={20} color={theme.accentDark} />
            </TouchableOpacity>
          </View>
          <TouchableOpacity onPress={onClose}><Ionicons name="close" size={24} color={theme.textSecondary} /></TouchableOpacity>
        </View>
        <ScrollView contentContainerStyle={[styles.body, contentStyle]} keyboardShouldPersistTaps="handled">
          <View style={styles.note}>
            <Ionicons name="information-circle-outline" size={18} color={theme.accentDark} />
            <Text style={styles.noteText}>
              Informe <Text style={styles.noteBold}>o odômetro atual</Text> e marque <Text style={styles.noteBold}>tanque cheio</Text> quando completar o tanque. Abastecimentos parciais entram na conta do próximo tanque cheio.
            </Text>
          </View>

          <View style={styles.card}>
            <TextInput style={styles.input} value={local} onChangeText={setLocal} placeholder="Local (cidade / bairro)" placeholderTextColor={theme.textSecondary} />
            <View style={styles.sep} />
            <TextInput style={styles.input} value={flag} onChangeText={setFlag} placeholder="Bandeira (ex: Shell)" placeholderTextColor={theme.textSecondary} />
          </View>

          <View style={styles.chips}>
            {['Shell', 'Ipiranga', 'Petrobras', 'Ale', 'Vibra', 'Rodoil', 'Gulf'].map(f => (
              <TouchableOpacity key={f} style={[styles.chip, flag === f && styles.chipActive]} onPress={() => setFlag(f)}>
                <Text style={[styles.chipText, flag === f && styles.chipTextActive]}>{f}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.card}>
            <TextInput style={styles.input} value={fuelType} onChangeText={setFuelType} placeholder="Tipo de combustível" placeholderTextColor={theme.textSecondary} />
          </View>
          <View style={styles.chips}>
            {['Comum', 'Aditivada', 'Podium', 'Álcool', 'Diesel', 'GNV'].map(t => (
              <TouchableOpacity key={t} style={[styles.chip, fuelType === t && styles.chipActive]} onPress={() => setFuelType(t)}>
                <Text style={[styles.chipText, fuelType === t && styles.chipTextActive]}>{t}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.card}>
            <View style={styles.fieldRow}><Text style={styles.fieldLabel}>Valor pago *</Text><CurrencyInput cents={cents} onChange={setCents} /></View>
            <View style={styles.sep} />
            <View style={styles.fieldRow}>
              <Text style={styles.fieldLabel}>Litros</Text>
              <TextInput style={styles.inlineInput} value={litersText} onChangeText={t => setLitersText(litersMask(t))} keyboardType="numeric" placeholder="0,000" placeholderTextColor={theme.textTertiary} />
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
              <Text style={styles.fieldLabel}>Odômetro (km atual)</Text>
              <TextInput style={styles.inlineInput} value={kmText} onChangeText={t => setKmText(kmMask(t))} keyboardType="numeric" placeholder="0" placeholderTextColor={theme.textTertiary} />
            </View>
            <Text style={styles.fieldHint}>Total de km no painel do carro agora — não é quanto você rodou desde o último abastecimento.</Text>
            <View style={styles.sep} />
            <View style={styles.fieldRow}>
              <Text style={styles.fieldLabel}>Tanque cheio</Text>
              <View style={styles.segControl}>
                <TouchableOpacity style={[styles.seg, fullTank && styles.segActive]} onPress={() => setFullTank(true)}>
                  <Text style={[styles.segText, fullTank && styles.segTextActive]}>Sim</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.seg, !fullTank && styles.segActive]} onPress={() => setFullTank(false)}>
                  <Text style={[styles.segText, !fullTank && styles.segTextActive]}>Não</Text>
                </TouchableOpacity>
              </View>
            </View>
            <Text style={styles.fieldHint}>Marque "Sim" só quando encher o tanque até a boca. Abastecimento parcial marca "Não" — a média fecha certa no próximo tanque cheio.</Text>
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

      <Modal visible={showInfo} transparent animationType="fade" onRequestClose={() => setShowInfo(false)}>
        <View style={styles.infoOverlay}>
          <View style={styles.infoModal}>
            <View style={styles.infoModalHeader}>
              <Ionicons name="information-circle" size={22} color={theme.accentDark} />
              <Text style={styles.infoModalTitle}>Como preencher</Text>
            </View>
            <Text style={styles.infoModalText}>
              <Text style={styles.infoModalBold}>Odômetro:</Text> o total de km do carro agora (o número do painel), não os km rodados desde o último posto.
            </Text>
            <Text style={styles.infoModalText}>
              <Text style={styles.infoModalBold}>Tanque cheio:</Text> marque "Sim" só quando encheu o tanque até a boca. Se abasteceu só uma parte, marque "Não" — esse valor se soma ao próximo tanque cheio pra fechar a média certa.
            </Text>
            <Text style={styles.infoModalText}>
              <Text style={styles.infoModalBold}>Litros e valor pago:</Text> usados pra calcular o preço do litro e, junto com o odômetro, a média de consumo.
            </Text>
            <TouchableOpacity style={styles.infoModalBtn} onPress={() => setShowInfo(false)}>
              <Text style={styles.infoModalBtnText}>Entendi</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
  fieldHint: { fontSize: 12, color: theme.textTertiary, paddingHorizontal: 16, paddingBottom: 12, marginTop: -8, lineHeight: 16 },
  inlineInput: { fontSize: 16, color: theme.text, paddingVertical: 14, minWidth: 120, textAlign: 'right' },
  computed: { fontSize: 16, fontWeight: '700', color: theme.accentDark, paddingVertical: 14 },
  segControl: { flexDirection: 'row', backgroundColor: theme.bg, borderRadius: 10, overflow: 'hidden' },
  seg: { paddingHorizontal: 16, paddingVertical: 8, alignItems: 'center' },
  segActive: { backgroundColor: theme.accent },
  segText: { fontSize: 13, fontWeight: '600', color: theme.textSecondary },
  segTextActive: { color: '#000', fontWeight: '700' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 16, backgroundColor: theme.card, borderWidth: 1, borderColor: theme.border },
  chipActive: { backgroundColor: theme.accentSubtle, borderColor: theme.accentDark },
  chipText: { fontSize: 13, fontWeight: '600', color: theme.textSecondary },
  chipTextActive: { color: theme.accentDark },
  saveBtn: { backgroundColor: theme.accent, borderRadius: 16, paddingVertical: 16, alignItems: 'center', marginTop: 8, ...theme.shadowMd },
  saveBtnText: { fontSize: 16, fontWeight: '800', color: '#000' },
  infoOverlay: { flex: 1, backgroundColor: '#00000070', alignItems: 'center', justifyContent: 'center', padding: 32 },
  infoModal: { width: '100%', maxWidth: 400, backgroundColor: theme.card, borderRadius: 20, padding: 24, gap: 10 },
  infoModalHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  infoModalTitle: { fontSize: 17, fontWeight: '800', color: theme.text },
  infoModalText: { fontSize: 14, color: theme.textSecondary, lineHeight: 20 },
  infoModalBold: { fontWeight: '700', color: theme.text },
  infoModalBtn: { backgroundColor: theme.accent, borderRadius: 12, paddingVertical: 12, alignItems: 'center', marginTop: 8 },
  infoModalBtnText: { fontSize: 15, fontWeight: '700', color: '#000' },
});
