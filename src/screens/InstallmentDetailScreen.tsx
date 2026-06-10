import React, { useCallback, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator,
  Modal, TextInput, Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { useTheme, Theme, formatBRL } from '../theme';
import { useResponsive } from '../hooks/useResponsive';
import { Installment, installmentStatus } from '../types';
import { financingService } from '../services/financingService';
import { installmentService } from '../services/installmentService';
import { imageService } from '../services/imageService';
import { CurrencyInput } from '../components/CurrencyInput';
import { StatusBadge } from '../components/StatusBadge';
import { RootStackParamList, TAB_BAR_BOTTOM_OFFSET } from '../navigation';
import { formatDate } from '../utils/date';
import { showAlert, showConfirm } from '../utils/dialogs';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Route = RouteProp<RootStackParamList, 'InstallmentDetail'>;

export const InstallmentDetailScreen: React.FC = () => {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const { contentStyle } = useResponsive();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const { financingId, installmentId } = route.params;
  const [installment, setInstallment] = useState<Installment | null>(null);
  const [loading, setLoading] = useState(true);
  const [showPayDialog, setShowPayDialog] = useState(false);
  const [payCents, setPayCents] = useState(0);
  const [payNote, setPayNote] = useState('');
  const [paying, setPaying] = useState(false);
  const [receiptUrls, setReceiptUrls] = useState<Record<string, string>>({});
  const [fullscreenUrl, setFullscreenUrl] = useState<string | null>(null);
  const [uploadingReceipt, setUploadingReceipt] = useState(false);

  const load = useCallback(async () => {
    const all = await financingService.getInstallments(financingId);
    const inst = all.find(i => i.id === installmentId) ?? null;
    setInstallment(inst);
    if (inst?.payment?.receiptPaths.length) {
      const urls: Record<string, string> = {};
      await Promise.all(inst.payment.receiptPaths.map(async p => {
        const url = await imageService.getSignedUrl(p);
        if (url) urls[p] = url;
      }));
      setReceiptUrls(urls);
    }
  }, [financingId, installmentId]);

  useFocusEffect(useCallback(() => {
    load().catch(() => null).finally(() => setLoading(false));
  }, [load]));

  if (loading || !installment) {
    return (
      <View style={[styles.container, styles.center]}>
        {loading ? <ActivityIndicator size="large" color={theme.accentDark} /> : <Text style={{ color: theme.textSecondary }}>Parcela não encontrada</Text>}
      </View>
    );
  }

  const status = installmentStatus(installment);
  const payment = installment.payment;

  const openPayDialog = () => {
    setPayCents(Math.round(installment.amount * 100));
    setPayNote('');
    setShowPayDialog(true);
  };

  const confirmPay = async () => {
    if (payCents <= 0) { showAlert('Erro', 'Informe o valor pago.'); return; }
    setPaying(true);
    try {
      await installmentService.markAsPaid(installment.id, Date.now(), payCents / 100, payNote);
      setShowPayDialog(false);
      await load();
    } catch (e: any) {
      showAlert('Erro', e?.message ?? 'Tente novamente');
    } finally {
      setPaying(false);
    }
  };

  const undoPayment = () => {
    showConfirm('Desfazer pagamento?', 'O registro de pagamento e os recibos serão removidos.', 'Desfazer', async () => {
      try {
        for (const p of payment?.receiptPaths ?? []) {
          await imageService.remove(p).catch(() => null);
        }
        await installmentService.undoPayment(installment.id);
        await load();
      } catch (e: any) {
        showAlert('Erro', e?.message ?? 'Tente novamente');
      }
    });
  };

  const addReceipt = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7 });
    if (result.canceled || !result.assets[0]) return;
    setUploadingReceipt(true);
    try {
      const path = await imageService.uploadReceipt(result.assets[0].uri);
      await installmentService.addReceipt(installment.id, path);
      await load();
    } catch (e: any) {
      showAlert('Erro ao enviar recibo', e?.message ?? 'Tente novamente');
    } finally {
      setUploadingReceipt(false);
    }
  };

  const removeReceipt = (path: string) => {
    showConfirm('Remover recibo?', 'A imagem será excluída.', 'Remover', async () => {
      await imageService.remove(path).catch(() => null);
      await installmentService.removeReceipt(installment.id, path);
      await load();
    });
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={[{ paddingTop: insets.top + 8, paddingBottom: TAB_BAR_BOTTOM_OFFSET + 20 }, contentStyle]}>
        <View style={styles.topBar}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={28} color={theme.accentDark} />
          </TouchableOpacity>
          <Text style={styles.topTitle}>Parcela {installment.number}</Text>
          <View style={{ width: 36 }} />
        </View>

        <View style={[styles.card, { alignItems: 'center', gap: 6 }]}>
          <StatusBadge status={status} />
          <Text style={styles.bigAmount}>{formatBRL(installment.amount)}</Text>
          <Text style={styles.dueDate}>Vencimento {formatDate(installment.dueDate)}</Text>
        </View>

        <View style={styles.card}>
          <Row label="Amortização" value={formatBRL(installment.principalAmount)} theme={theme} />
          <Row label="Juros" value={formatBRL(installment.interestAmount)} theme={theme} />
          <Row label="Saldo devedor após" value={formatBRL(installment.remainingBalance)} theme={theme} />
        </View>

        {!payment && (
          <TouchableOpacity style={styles.payBtn} onPress={openPayDialog}>
            <Ionicons name="checkmark-circle-outline" size={20} color="#000" />
            <Text style={styles.payBtnText}>Marcar como paga</Text>
          </TouchableOpacity>
        )}

        {payment && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Pagamento</Text>
            <Row label="Pago em" value={formatDate(payment.paidDate)} theme={theme} />
            <Row label="Valor pago" value={formatBRL(payment.paidAmount)} theme={theme} color="#22C55E" />
            {payment.note ? <Row label="Observação" value={payment.note} theme={theme} /> : null}

            <Text style={[styles.cardTitle, { marginTop: 12 }]}>Recibos</Text>
            <View style={styles.receiptGrid}>
              {payment.receiptPaths.map(p => (
                <TouchableOpacity key={p} onPress={() => receiptUrls[p] && setFullscreenUrl(receiptUrls[p])} onLongPress={() => removeReceipt(p)}>
                  {receiptUrls[p] ? (
                    <Image source={{ uri: receiptUrls[p] }} style={styles.receiptThumb} />
                  ) : (
                    <View style={[styles.receiptThumb, styles.receiptPlaceholder]}>
                      <ActivityIndicator size="small" color={theme.accentDark} />
                    </View>
                  )}
                </TouchableOpacity>
              ))}
              <TouchableOpacity style={[styles.receiptThumb, styles.addReceipt]} onPress={addReceipt} disabled={uploadingReceipt}>
                {uploadingReceipt
                  ? <ActivityIndicator size="small" color={theme.accentDark} />
                  : <Ionicons name="add" size={24} color={theme.accentDark} />}
              </TouchableOpacity>
            </View>
            <Text style={styles.receiptHint}>Toque para ampliar, segure para remover</Text>

            <TouchableOpacity style={styles.undoBtn} onPress={undoPayment}>
              <Text style={styles.undoBtnText}>Desfazer pagamento</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      <Modal visible={showPayDialog} transparent animationType="fade" onRequestClose={() => setShowPayDialog(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.payModal}>
            <Text style={styles.payModalTitle}>Marcar como paga</Text>
            <View style={styles.payField}>
              <Text style={styles.payFieldLabel}>Valor pago</Text>
              <CurrencyInput cents={payCents} onChange={setPayCents} />
            </View>
            <TextInput
              style={styles.noteInput}
              value={payNote}
              onChangeText={setPayNote}
              placeholder="Observação (opcional)"
              placeholderTextColor={theme.textSecondary}
            />
            <View style={styles.payModalBtns}>
              <TouchableOpacity style={styles.payModalCancel} onPress={() => setShowPayDialog(false)}>
                <Text style={styles.payModalCancelText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.payModalConfirm, paying && { opacity: 0.6 }]} onPress={confirmPay} disabled={paying}>
                {paying ? <ActivityIndicator size="small" color="#000" /> : <Text style={styles.payModalConfirmText}>Confirmar</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={!!fullscreenUrl} transparent animationType="fade" onRequestClose={() => setFullscreenUrl(null)}>
        <View style={styles.fullscreenOverlay}>
          <TouchableOpacity style={styles.fullscreenClose} onPress={() => setFullscreenUrl(null)}>
            <Ionicons name="close" size={28} color="#FFF" />
          </TouchableOpacity>
          {fullscreenUrl && <Image source={{ uri: fullscreenUrl }} style={styles.fullscreenImage} resizeMode="contain" />}
        </View>
      </Modal>
    </View>
  );
};

const Row: React.FC<{ label: string; value: string; theme: Theme; color?: string }> = ({ label, value, theme, color }) => (
  <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 7, gap: 12 }}>
    <Text style={{ fontSize: 14, color: theme.textSecondary }}>{label}</Text>
    <Text style={{ fontSize: 14, fontWeight: '700', color: color ?? theme.text, flexShrink: 1, textAlign: 'right' }}>{value}</Text>
  </View>
);

const makeStyles = (theme: Theme) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.bg },
  center: { alignItems: 'center', justifyContent: 'center' },
  topBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, marginBottom: 12 },
  backBtn: { padding: 4 },
  topTitle: { flex: 1, fontSize: 20, fontWeight: '800', color: theme.text, textAlign: 'center' },
  card: { marginHorizontal: 16, marginBottom: 12, backgroundColor: theme.card, borderRadius: 16, padding: 16, ...theme.shadow },
  cardTitle: { fontSize: 13, fontWeight: '700', color: theme.textSecondary, letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 4 },
  bigAmount: { fontSize: 32, fontWeight: '900', color: theme.text },
  dueDate: { fontSize: 14, color: theme.textSecondary },
  payBtn: {
    flexDirection: 'row', gap: 8, marginHorizontal: 16, backgroundColor: theme.accent,
    borderRadius: 16, paddingVertical: 16, alignItems: 'center', justifyContent: 'center', ...theme.shadowMd,
  },
  payBtnText: { fontSize: 16, fontWeight: '800', color: '#000' },
  receiptGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 4 },
  receiptThumb: { width: 72, height: 72, borderRadius: 12 },
  receiptPlaceholder: { backgroundColor: theme.bg, alignItems: 'center', justifyContent: 'center' },
  addReceipt: {
    backgroundColor: theme.accentSubtle, borderWidth: 1.5, borderColor: theme.accentBorder,
    borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center',
  },
  receiptHint: { fontSize: 11, color: theme.textTertiary, marginTop: 8 },
  undoBtn: { marginTop: 14, alignSelf: 'center', paddingHorizontal: 18, paddingVertical: 9, borderRadius: 12, backgroundColor: theme.spend + '14' },
  undoBtnText: { fontSize: 14, fontWeight: '700', color: theme.spend },
  modalOverlay: { flex: 1, backgroundColor: '#00000070', alignItems: 'center', justifyContent: 'center', padding: 32 },
  payModal: { width: '100%', maxWidth: 400, backgroundColor: theme.card, borderRadius: 20, padding: 24, gap: 14 },
  payModalTitle: { fontSize: 18, fontWeight: '800', color: theme.text },
  payField: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, borderWidth: 1, borderColor: theme.border, borderRadius: 12, paddingHorizontal: 14 },
  payFieldLabel: { fontSize: 14, color: theme.textSecondary },
  noteInput: { fontSize: 15, color: theme.text, borderWidth: 1, borderColor: theme.border, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12 },
  payModalBtns: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12 },
  payModalCancel: { paddingHorizontal: 18, paddingVertical: 10, borderRadius: 12, backgroundColor: theme.bg },
  payModalCancelText: { fontSize: 15, fontWeight: '600', color: theme.textSecondary },
  payModalConfirm: { paddingHorizontal: 18, paddingVertical: 10, borderRadius: 12, backgroundColor: theme.accent },
  payModalConfirmText: { fontSize: 15, fontWeight: '700', color: '#000' },
  fullscreenOverlay: { flex: 1, backgroundColor: '#000000EE', alignItems: 'center', justifyContent: 'center' },
  fullscreenClose: { position: 'absolute', top: 50, right: 20, zIndex: 10, padding: 8 },
  fullscreenImage: { width: '100%', height: '80%' },
});
