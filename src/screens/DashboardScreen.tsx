import React, { useCallback, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Modal, TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme, Theme, formatBRL } from '../theme';
import { useResponsive } from '../hooks/useResponsive';
import { FinancingWithInstallments, Installment, isCurrentMonth } from '../types';
import { financingService } from '../services/financingService';
import { installmentService } from '../services/installmentService';
import { sharingService, FinancingMember } from '../services/sharingService';
import { adminService } from '../services/adminService';
import { RootStackParamList, TAB_BAR_BOTTOM_OFFSET } from '../navigation';
import { formatDate, daysUntil } from '../utils/date';
import { showAlert, showConfirm } from '../utils/dialogs';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Route = RouteProp<RootStackParamList, 'Dashboard'>;

export const DashboardScreen: React.FC = () => {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const { contentStyle } = useResponsive();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const { financingId, readOnly, ownerUsername } = route.params;
  const [financing, setFinancing] = useState<FinancingWithInstallments | null>(null);
  const [loading, setLoading] = useState(true);
  const [showShareModal, setShowShareModal] = useState(false);
  const [shareUsername, setShareUsername] = useState('');
  const [sharePermission, setSharePermission] = useState<'view' | 'edit'>('view');
  const [userSuggestions, setUserSuggestions] = useState<string[]>([]);
  const [sharing, setSharing] = useState(false);
  const [members, setMembers] = useState<FinancingMember[]>([]);
  const [showInfo, setShowInfo] = useState(false);

  const load = useCallback(async () => {
    const [data, mbrs] = await Promise.all([
      financingService.getById(financingId),
      sharingService.getMembers(financingId),
    ]);
    setFinancing(data);
    setMembers(mbrs);
  }, [financingId]);

  useFocusEffect(useCallback(() => {
    load().catch(() => null).finally(() => setLoading(false));
  }, [load]));

  if (loading || !financing) {
    return (
      <View style={[styles.container, styles.center]}>
        {loading ? <ActivityIndicator size="large" color={theme.accentDark} /> : <Text style={{ color: theme.textSecondary }}>Financiamento não encontrado</Text>}
      </View>
    );
  }

  const installments = financing.installments;
  const paid = installments.filter(i => i.payment);
  const unpaid = installments.filter(i => !i.payment);
  const paidTotal = paid.reduce((s, i) => s + (i.payment?.paidAmount ?? 0), 0);
  const remainingTotal = unpaid.reduce((s, i) => s + i.amount, 0);
  const progress = installments.length > 0 ? paid.length / installments.length : 0;

  const featured: Installment | undefined =
    unpaid.find(i => isCurrentMonth(i)) ?? unpaid[0];

  const quickPay = () => {
    if (!featured) return;
    showConfirm(
      `Pagar parcela ${featured.number}?`,
      `${formatBRL(featured.amount)} — vencimento ${formatDate(featured.dueDate)}`,
      'Pagar',
      async () => {
        try {
          await installmentService.markAsPaid(featured.id, Date.now(), featured.amount, null);
          await load();
        } catch (e: any) {
          showAlert('Erro', e?.message ?? 'Tente novamente');
        }
      },
    );
  };

  const handleShare = async () => {
    if (!shareUsername.trim()) {
      showAlert('Username vazio', 'Digite um username válido');
      return;
    }
    setSharing(true);
    try {
      await sharingService.sendInvite(financingId, shareUsername.trim(), sharePermission);
      const newMembers = await sharingService.getMembers(financingId);
      setMembers(newMembers);
      setShareUsername('');
      setSharePermission('view');
      setUserSuggestions([]);
      setShowShareModal(false);
    } catch (e: any) {
      showAlert('Erro', e?.message ?? 'Tente novamente');
    } finally {
      setSharing(false);
    }
  };

  const handleTogglePermission = async (member: FinancingMember) => {
    const next: 'view' | 'edit' = member.permission === 'view' ? 'edit' : 'view';
    setMembers(cur => cur.map(m => m.shareId === member.shareId ? { ...m, permission: next } : m));
    try {
      await sharingService.updateMemberPermission(member.shareId, next);
    } catch (e: any) {
      setMembers(cur => cur.map(m => m.shareId === member.shareId ? { ...m, permission: member.permission } : m));
      showAlert('Erro', e?.message ?? 'Não foi possível alterar a permissão');
    }
  };

  const handleRemoveMember = (member: FinancingMember) => {
    showConfirm(
      `Remover @${member.username}?`,
      'Essa pessoa perderá o acesso ao financiamento.',
      'Remover',
      async () => {
        try {
          await sharingService.removeShare(member.shareId);
          setMembers(cur => cur.filter(m => m.shareId !== member.shareId));
        } catch (e: any) {
          showAlert('Erro', e?.message ?? 'Não foi possível remover');
        }
      },
    );
  };

  const days = featured ? daysUntil(featured.dueDate) : 0;

  return (
    <View style={styles.container}>
      <View style={[styles.topBar, { paddingTop: insets.top + 4 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={28} color={theme.accentDark} />
        </TouchableOpacity>
        <Text style={styles.topTitle} numberOfLines={1}>{financing.carName}</Text>
        <View style={styles.topButtonsGroup}>
          {readOnly && (
            <TouchableOpacity onPress={() => setShowInfo(true)} style={styles.topBtn}>
              <Ionicons name="information-circle-outline" size={24} color={theme.accentDark} />
            </TouchableOpacity>
          )}
          {!readOnly && (
            <TouchableOpacity onPress={() => navigation.navigate('EditFinancing', { financingId })} style={styles.topBtn}>
              <Ionicons name="pencil" size={20} color={theme.accentDark} />
            </TouchableOpacity>
          )}
          {!readOnly && (
            <TouchableOpacity onPress={() => setShowShareModal(true)} style={styles.topBtn}>
              <Ionicons name="share-social-outline" size={20} color={theme.accentDark} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <ScrollView contentContainerStyle={[{ paddingBottom: TAB_BAR_BOTTOM_OFFSET + 20 }, contentStyle]}>
        <View style={styles.card}>
          <View style={styles.progressHeader}>
            <Text style={styles.progressLabel}>{paid.length} de {installments.length} parcelas</Text>
            <Text style={styles.progressPct}>{Math.round(progress * 100)}%</Text>
          </View>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
          </View>
        </View>

        <View style={styles.card}>
          {financing.vehicleValue > 0 && (
            <Row label="Valor do veículo" value={formatBRL(financing.vehicleValue)} theme={theme} />
          )}
          <Row label="Custo total" value={formatBRL(paidTotal + remainingTotal)} theme={theme} />
          <Row label="Pago" value={formatBRL(paidTotal)} theme={theme} color="#22C55E" />
          <Row label="Restante" value={formatBRL(remainingTotal)} theme={theme} color={theme.orange} />
        </View>

        {featured && (
          <View style={[styles.card, styles.quickPay]}>
            <View style={styles.quickPayHeader}>
              <Text style={styles.quickPayBadge}>{isCurrentMonth(featured) ? 'ESTE MÊS' : 'PRÓXIMA'}</Text>
              <Text style={styles.quickPayDays}>
                {days < 0 ? `${-days} dia${days !== -1 ? 's' : ''} em atraso` : days === 0 ? 'Vence hoje' : `Vence em ${days} dia${days !== 1 ? 's' : ''}`}
              </Text>
            </View>
            <Text style={styles.quickPayTitle}>Parcela {featured.number}</Text>
            <Text style={styles.quickPayAmount}>{formatBRL(featured.amount)}</Text>
            <Text style={styles.quickPayDate}>{formatDate(featured.dueDate)}</Text>
            {!readOnly && (
              <TouchableOpacity style={styles.quickPayBtn} onPress={quickPay}>
                <Text style={styles.quickPayBtnText}>Pagar agora</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {!featured && (
          <View style={[styles.card, styles.doneCard]}>
            <Ionicons name="trophy" size={36} color={theme.orange} />
            <Text style={styles.doneTitle}>Financiamento quitado! 🎉</Text>
          </View>
        )}

        {readOnly && ownerUsername && (
          <View style={styles.card}>
            <Text style={styles.memberUsername}>Financiamento de: @{ownerUsername}</Text>
          </View>
        )}

        {!readOnly && members.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.membersTitle}>Compartilhado com</Text>
            {members.map((m, idx) => (
              <View key={m.shareId}>
                {idx > 0 && <View style={styles.sep} />}
                <View style={styles.memberRow}>
                  <View style={[styles.memberAvatar, { backgroundColor: theme.accent + '30' }]}>
                    <Ionicons name="person" size={13} color={theme.accentDark} />
                  </View>
                  <Text style={styles.memberUsername}>@{m.username}</Text>
                  <TouchableOpacity
                    style={[styles.permissionBadge, m.permission === 'edit' && styles.permissionBadgeEdit]}
                    onPress={() => handleTogglePermission(m)}
                  >
                    <Text style={[styles.permissionBadgeText, m.permission === 'edit' && styles.permissionBadgeTextEdit]}>
                      {m.permission === 'edit' ? 'editar' : 'ver'}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => handleRemoveMember(m)} style={styles.memberRemoveBtn}>
                    <Ionicons name="close-circle" size={18} color={theme.textSecondary} />
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        )}

        <View style={styles.card}>
          <NavRow icon="list-outline" label="Ver todas as parcelas" onPress={() => navigation.navigate('Installments', { financingId, readOnly: readOnly ?? false })} theme={theme} styles={styles} />
          <View style={styles.sep} />
          <NavRow icon="bar-chart-outline" label="Relatório" onPress={() => navigation.navigate('Report', { financingId })} theme={theme} styles={styles} />
          {!readOnly && (
            <>
              <View style={styles.sep} />
              <NavRow icon="trending-down-outline" label="Simular antecipação" onPress={() => navigation.navigate('Simulation', { financingId })} theme={theme} styles={styles} />
            </>
          )}
        </View>
      </ScrollView>

      <Modal visible={showInfo} transparent animationType="fade" onRequestClose={() => setShowInfo(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowInfo(false)}>
          <TouchableOpacity activeOpacity={1} style={styles.infoModal}>
            <Text style={styles.shareModalTitle}>Sobre o financiamento</Text>
            <View style={{ gap: 2, marginTop: 8 }}>
              <Row label="Veículo" value={financing.carName} theme={theme} />
              {financing.licensePlate ? <Row label="Placa" value={financing.licensePlate} theme={theme} /> : null}
              {financing.bank ? <Row label="Banco" value={financing.bank} theme={theme} /> : null}
              {financing.vehicleValue > 0 && <Row label="Valor do veículo" value={formatBRL(financing.vehicleValue)} theme={theme} />}
              {financing.downPayment > 0 && <Row label="Entrada" value={formatBRL(financing.downPayment)} theme={theme} />}
              {financing.monthlyRate > 0 && <Row label="Taxa mensal" value={`${financing.monthlyRate.toFixed(2)}%`} theme={theme} />}
              <Row label="Parcelas" value={`${financing.totalInstallments}x`} theme={theme} />
              <Row label="1ª parcela" value={formatDate(financing.firstDueDate)} theme={theme} />
              {ownerUsername ? <Row label="Dono" value={`@${ownerUsername}`} theme={theme} /> : null}
            </View>
            <TouchableOpacity style={styles.infoCloseBtn} onPress={() => setShowInfo(false)}>
              <Text style={styles.infoCloseBtnText}>Fechar</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      <Modal visible={showShareModal} transparent animationType="fade" onRequestClose={() => { setShowShareModal(false); setShareUsername(''); setUserSuggestions([]); }}>
        <View style={styles.modalOverlay}>
          <View style={styles.shareModal}>
            <Text style={styles.shareModalTitle}>Compartilhar financiamento</Text>
            <Text style={styles.shareModalSub}>Digite o username de quem você quer compartilhar.</Text>
            <TextInput
              style={styles.shareInput}
              placeholder="username"
              placeholderTextColor={theme.textSecondary}
              value={shareUsername}
              onChangeText={async (v) => {
                setShareUsername(v);
                if (v.trim().length >= 2) {
                  const results = await adminService.searchUsernames(v.trim());
                  setUserSuggestions(results);
                } else {
                  setUserSuggestions([]);
                }
              }}
              editable={!sharing}
              autoCapitalize="none"
              autoCorrect={false}
            />
            {userSuggestions.length > 0 && (
              <View style={styles.suggestionsBox}>
                {userSuggestions.map(u => (
                  <TouchableOpacity
                    key={u}
                    style={styles.suggestionRow}
                    onPress={() => { setShareUsername(u); setUserSuggestions([]); }}
                  >
                    <Ionicons name="person-circle-outline" size={18} color={theme.accentDark} />
                    <Text style={styles.suggestionUser}>@{u}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
            <View style={styles.permissionPicker}>
              <Text style={styles.permissionPickerLabel}>Permissão</Text>
              <View style={styles.permissionPickerBtns}>
                <TouchableOpacity
                  style={[styles.permissionPickerBtn, sharePermission === 'view' && styles.permissionPickerBtnActive]}
                  onPress={() => setSharePermission('view')}
                >
                  <Text style={[styles.permissionPickerBtnText, sharePermission === 'view' && styles.permissionPickerBtnTextActive]}>Ver</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.permissionPickerBtn, sharePermission === 'edit' && styles.permissionPickerBtnActive]}
                  onPress={() => setSharePermission('edit')}
                >
                  <Text style={[styles.permissionPickerBtnText, sharePermission === 'edit' && styles.permissionPickerBtnTextActive]}>Ver e editar</Text>
                </TouchableOpacity>
              </View>
            </View>
            <View style={styles.shareModalBtns}>
              <TouchableOpacity style={styles.shareBtnCancel} onPress={() => { setShowShareModal(false); setShareUsername(''); setUserSuggestions([]); }} disabled={sharing}>
                <Text style={styles.shareBtnCancelText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.shareBtnConfirm, (!shareUsername.trim() || sharing) && { opacity: 0.4 }]} onPress={handleShare} disabled={sharing || !shareUsername.trim()}>
                {sharing ? (
                  <ActivityIndicator size="small" color="#000" />
                ) : (
                  <Text style={styles.shareBtnConfirmText}>Compartilhar</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};


const Row: React.FC<{ label: string; value: string; theme: Theme; color?: string }> = ({ label, value, theme, color }) => (
  <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 7 }}>
    <Text style={{ fontSize: 14, color: theme.textSecondary }}>{label}</Text>
    <Text style={{ fontSize: 14, fontWeight: '700', color: color ?? theme.text }}>{value}</Text>
  </View>
);

const NavRow: React.FC<{
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  onPress: () => void;
  theme: Theme;
  styles: ReturnType<typeof makeStyles>;
}> = ({ icon, label, onPress, theme, styles }) => (
  <TouchableOpacity style={styles.navRow} onPress={onPress} activeOpacity={0.7}>
    <Ionicons name={icon} size={20} color={theme.accentDark} />
    <Text style={styles.navRowText}>{label}</Text>
    <Ionicons name="chevron-forward" size={16} color={theme.textTertiary} />
  </TouchableOpacity>
);

const makeStyles = (theme: Theme) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.bg },
  center: { alignItems: 'center', justifyContent: 'center' },
  topBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingBottom: 10, backgroundColor: theme.bg, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: theme.border },
  backBtn: { padding: 4 },
  topTitle: { flex: 1, fontSize: 20, fontWeight: '800', color: theme.text, textAlign: 'center' },
  topButtonsGroup: { flexDirection: 'row', gap: 4 },
  topBtn: { padding: 8 },
  card: { marginHorizontal: 16, marginBottom: 12, backgroundColor: theme.card, borderRadius: 16, padding: 16, ...theme.shadow },
  progressHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  progressLabel: { fontSize: 14, fontWeight: '600', color: theme.text },
  progressPct: { fontSize: 14, fontWeight: '800', color: theme.accentDark },
  progressBar: { height: 8, borderRadius: 4, backgroundColor: theme.separator, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 4, backgroundColor: theme.accentDark },
  sep: { height: StyleSheet.hairlineWidth, backgroundColor: theme.separator },
  quickPay: { alignItems: 'center', gap: 4 },
  quickPayHeader: { flexDirection: 'row', justifyContent: 'space-between', alignSelf: 'stretch', marginBottom: 6 },
  quickPayBadge: { fontSize: 11, fontWeight: '800', color: theme.accentDark, letterSpacing: 0.5 },
  quickPayDays: { fontSize: 12, fontWeight: '600', color: theme.textSecondary },
  quickPayTitle: { fontSize: 14, color: theme.textSecondary },
  quickPayAmount: { fontSize: 30, fontWeight: '900', color: theme.text },
  quickPayDate: { fontSize: 13, color: theme.textSecondary },
  quickPayBtn: { marginTop: 10, backgroundColor: theme.accent, borderRadius: 14, paddingHorizontal: 32, paddingVertical: 13, ...theme.shadowMd },
  quickPayBtnText: { fontSize: 15, fontWeight: '800', color: '#000' },
  doneCard: { alignItems: 'center', gap: 8, paddingVertical: 24 },
  doneTitle: { fontSize: 17, fontWeight: '800', color: theme.text },
  navRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 13 },
  navRowText: { flex: 1, fontSize: 15, fontWeight: '600', color: theme.text },
  modalOverlay: { flex: 1, backgroundColor: '#00000070', alignItems: 'center', justifyContent: 'center', padding: 32 },
  shareModal: { width: '100%', maxWidth: 400, backgroundColor: theme.card, borderRadius: 20, padding: 24, gap: 12 },
  shareModalTitle: { fontSize: 18, fontWeight: '800', color: theme.text },
  shareModalSub: { fontSize: 14, color: theme.textSecondary },
  shareInput: { borderWidth: 1, borderColor: theme.border, borderRadius: 12, padding: 12, fontSize: 15, color: theme.text, backgroundColor: theme.bg, marginVertical: 8 },
  shareModalBtns: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12, marginTop: 4 },
  shareBtnCancel: { paddingHorizontal: 18, paddingVertical: 10, borderRadius: 12, backgroundColor: theme.bg },
  shareBtnCancelText: { fontSize: 15, fontWeight: '600', color: theme.textSecondary },
  shareBtnConfirm: { paddingHorizontal: 18, paddingVertical: 10, borderRadius: 12, backgroundColor: theme.accent, alignItems: 'center', justifyContent: 'center', minWidth: 90 },
  shareBtnConfirmText: { fontSize: 15, fontWeight: '700', color: '#000' },
  suggestionsBox: { backgroundColor: theme.bg, borderRadius: 10, overflow: 'hidden', borderWidth: 1, borderColor: theme.border, marginTop: -4 },
  suggestionRow: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: theme.separator },
  suggestionUser: { fontSize: 14, fontWeight: '600', color: theme.text },
  membersTitle: { fontSize: 11, fontWeight: '700', letterSpacing: 0.5, color: theme.textSecondary, textTransform: 'uppercase', marginBottom: 8 },
  memberRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 },
  memberAvatar: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  memberUsername: { fontSize: 14, fontWeight: '600', color: theme.text, flex: 1 },
  memberRemoveBtn: { padding: 4 },
  permissionBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, backgroundColor: theme.separator, borderWidth: 1, borderColor: theme.border },
  permissionBadgeEdit: { backgroundColor: theme.accent + '25', borderColor: theme.accentDark + '55' },
  permissionBadgeText: { fontSize: 11, fontWeight: '700', color: theme.textSecondary },
  permissionBadgeTextEdit: { color: theme.accentDark },
  permissionPicker: { gap: 8 },
  permissionPickerLabel: { fontSize: 12, fontWeight: '600', color: theme.textSecondary },
  permissionPickerBtns: { flexDirection: 'row', gap: 8 },
  permissionPickerBtn: { flex: 1, paddingVertical: 8, borderRadius: 10, alignItems: 'center', backgroundColor: theme.bg, borderWidth: 1, borderColor: theme.border },
  permissionPickerBtnActive: { backgroundColor: theme.accent + '25', borderColor: theme.accentDark },
  permissionPickerBtnText: { fontSize: 13, fontWeight: '600', color: theme.textSecondary },
  permissionPickerBtnTextActive: { color: theme.accentDark },
  infoModal: { width: '100%', maxWidth: 400, backgroundColor: theme.card, borderRadius: 20, padding: 24, gap: 4 },
  infoCloseBtn: { marginTop: 16, backgroundColor: theme.accent, borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
  infoCloseBtnText: { fontSize: 15, fontWeight: '700', color: '#000' },
});
