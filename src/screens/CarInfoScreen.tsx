import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Modal, TextInput, Image,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTheme, Theme, formatBRL } from '../theme';
import { useResponsive } from '../hooks/useResponsive';
import { useCar } from '../contexts/CarContext';
import { imageService } from '../services/imageService';
import { fuelService } from '../services/fuelService';
import { FuelFillup, lastFuelStats } from '../types';
import { sharingService, FinancingMember } from '../services/sharingService';
import { adminService } from '../services/adminService';
import { RootStackParamList, TAB_BAR_BOTTOM_OFFSET } from '../navigation';
import { showAlert, showConfirm } from '../utils/dialogs';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export const CarInfoScreen: React.FC = () => {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const { contentStyle } = useResponsive();
  const navigation = useNavigation<Nav>();
  const { financingId, readOnly, ownerUsername, car, loading, reload } = useCar();

  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [members, setMembers] = useState<FinancingMember[]>([]);
  const [fuel, setFuel] = useState<FuelFillup[]>([]);
  const [showShareModal, setShowShareModal] = useState(false);
  const [shareUsername, setShareUsername] = useState('');
  const [sharePermission, setSharePermission] = useState<'view' | 'edit'>('view');
  const [userSuggestions, setUserSuggestions] = useState<string[]>([]);
  const [sharing, setSharing] = useState(false);

  useFocusEffect(useCallback(() => {
    reload().catch(() => null);
    sharingService.getMembers(financingId).then(setMembers).catch(() => null);
    fuelService.listByCar(financingId).then(setFuel).catch(() => null);
  }, [financingId, reload]));

  useEffect(() => {
    let active = true;
    if (car?.carPhotoPath) {
      imageService.getOrCachePhoto(car.carPhotoPath).then(url => { if (active) setPhotoUrl(url); });
    } else {
      setPhotoUrl(null);
    }
    return () => { active = false; };
  }, [car?.carPhotoPath]);

  const handleShare = async () => {
    if (!shareUsername.trim()) { showAlert('Username vazio', 'Digite um username válido'); return; }
    setSharing(true);
    try {
      await sharingService.sendInvite(financingId, shareUsername.trim(), sharePermission);
      setMembers(await sharingService.getMembers(financingId));
      setShareUsername(''); setSharePermission('view'); setUserSuggestions([]); setShowShareModal(false);
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
    showConfirm(`Remover @${member.username}?`, 'Essa pessoa perderá o acesso ao carro.', 'Remover', async () => {
      try {
        await sharingService.removeShare(member.shareId);
        setMembers(cur => cur.filter(m => m.shareId !== member.shareId));
      } catch (e: any) {
        showAlert('Erro', e?.message ?? 'Não foi possível remover');
      }
    });
  };

  if (loading || !car) {
    return (
      <View style={[styles.container, styles.center]}>
        {loading ? <ActivityIndicator size="large" color={theme.accentDark} /> : <Text style={{ color: theme.textSecondary }}>Carro não encontrado</Text>}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={[{ paddingTop: 12, paddingBottom: TAB_BAR_BOTTOM_OFFSET + 96 }, contentStyle]}>
        <View style={styles.photoWrap}>
          {photoUrl ? (
            <Image source={{ uri: photoUrl }} style={styles.photo} />
          ) : (
            <View style={[styles.photo, styles.photoPlaceholder]}>
              <Ionicons name="car-sport" size={56} color={theme.accentDark} />
            </View>
          )}
        </View>

        {!readOnly && (
          <View style={styles.actionsRow}>
            <TouchableOpacity style={styles.actionBtn} onPress={() => navigation.navigate('EditCar', { financingId })}>
              <Ionicons name="pencil" size={18} color={theme.accentDark} />
              <Text style={styles.actionText}>Editar</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionBtn} onPress={() => setShowShareModal(true)}>
              <Ionicons name="share-social-outline" size={18} color={theme.accentDark} />
              <Text style={styles.actionText}>Compartilhar</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.card}>
          <Row label="Veículo" value={car.carName} theme={theme} />
          {car.brand ? <Row label="Marca" value={car.brand} theme={theme} /> : null}
          {car.model ? <Row label="Modelo" value={car.model} theme={theme} /> : null}
          {car.year ? <Row label="Ano" value={String(car.year)} theme={theme} /> : null}
          {car.color ? <Row label="Cor" value={car.color} theme={theme} /> : null}
          {car.licensePlate ? <Row label="Placa" value={car.licensePlate} theme={theme} /> : null}
          <Row label="Quilometragem" value={`${car.currentKm.toLocaleString('pt-BR')} km`} theme={theme} />
          {ownerUsername ? <Row label="Dono" value={`@${ownerUsername}`} theme={theme} /> : null}
        </View>

        <View style={styles.card}>
          <Text style={styles.membersTitle}>Consumo atual</Text>
          {(() => {
            const last = lastFuelStats(fuel);
            if (last == null) {
              return <Text style={styles.consumptionHint}>Registre abastecimentos com os km rodados para ver o consumo.</Text>;
            }
            const range = car.tankLiters ? last.kmL * car.tankLiters : null;
            return (
              <>
                <Row label="Consumo" value={`${last.kmL.toFixed(1)} km/L`} theme={theme} />
                {last.costPerKm > 0 && <Row label="Custo por km" value={`${formatBRL(last.costPerKm)}/km`} theme={theme} />}
                {range != null ? (
                  <Row label="Autonomia (tanque cheio)" value={`${Math.round(range).toLocaleString('pt-BR')} km`} theme={theme} />
                ) : (
                  <Text style={styles.consumptionHint}>Informe os litros do tanque (Editar) para estimar a autonomia.</Text>
                )}
              </>
            );
          })()}
        </View>

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
      </ScrollView>

      <TouchableOpacity
        style={styles.fuelFab}
        activeOpacity={0.85}
        onPress={() => navigation.navigate('Fuel', { financingId, readOnly, currentKm: car.currentKm })}
      >
        <MaterialCommunityIcons name="gas-station" size={26} color="#000" />
      </TouchableOpacity>

      <Modal visible={showShareModal} transparent animationType="fade" onRequestClose={() => { setShowShareModal(false); setShareUsername(''); setUserSuggestions([]); }}>
        <View style={styles.modalOverlay}>
          <View style={styles.shareModal}>
            <Text style={styles.shareModalTitle}>Compartilhar carro</Text>
            <Text style={styles.shareModalSub}>Digite o username de quem você quer compartilhar.</Text>
            <TextInput
              style={styles.shareInput}
              placeholder="username"
              placeholderTextColor={theme.textSecondary}
              value={shareUsername}
              onChangeText={async (v) => {
                setShareUsername(v);
                if (v.trim().length >= 2) setUserSuggestions(await adminService.searchUsernames(v.trim()));
                else setUserSuggestions([]);
              }}
              editable={!sharing}
              autoCapitalize="none"
              autoCorrect={false}
            />
            {userSuggestions.length > 0 && (
              <View style={styles.suggestionsBox}>
                {userSuggestions.map(u => (
                  <TouchableOpacity key={u} style={styles.suggestionRow} onPress={() => { setShareUsername(u); setUserSuggestions([]); }}>
                    <Ionicons name="person-circle-outline" size={18} color={theme.accentDark} />
                    <Text style={styles.suggestionUser}>@{u}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
            <View style={styles.permissionPicker}>
              <Text style={styles.permissionPickerLabel}>Permissão</Text>
              <View style={styles.permissionPickerBtns}>
                <TouchableOpacity style={[styles.permissionPickerBtn, sharePermission === 'view' && styles.permissionPickerBtnActive]} onPress={() => setSharePermission('view')}>
                  <Text style={[styles.permissionPickerBtnText, sharePermission === 'view' && styles.permissionPickerBtnTextActive]}>Ver</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.permissionPickerBtn, sharePermission === 'edit' && styles.permissionPickerBtnActive]} onPress={() => setSharePermission('edit')}>
                  <Text style={[styles.permissionPickerBtnText, sharePermission === 'edit' && styles.permissionPickerBtnTextActive]}>Ver e editar</Text>
                </TouchableOpacity>
              </View>
            </View>
            <View style={styles.shareModalBtns}>
              <TouchableOpacity style={styles.shareBtnCancel} onPress={() => { setShowShareModal(false); setShareUsername(''); setUserSuggestions([]); }} disabled={sharing}>
                <Text style={styles.shareBtnCancelText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.shareBtnConfirm, (!shareUsername.trim() || sharing) && { opacity: 0.4 }]} onPress={handleShare} disabled={sharing || !shareUsername.trim()}>
                {sharing ? <ActivityIndicator size="small" color="#000" /> : <Text style={styles.shareBtnConfirmText}>Compartilhar</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const Row: React.FC<{ label: string; value: string; theme: Theme }> = ({ label, value, theme }) => (
  <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8 }}>
    <Text style={{ fontSize: 14, color: theme.textSecondary }}>{label}</Text>
    <Text style={{ fontSize: 14, fontWeight: '700', color: theme.text }}>{value}</Text>
  </View>
);

const makeStyles = (theme: Theme) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.bg },
  center: { alignItems: 'center', justifyContent: 'center' },
  fuelFab: { position: 'absolute', right: 20, bottom: TAB_BAR_BOTTOM_OFFSET + 16, width: 58, height: 58, borderRadius: 29, backgroundColor: theme.accent, alignItems: 'center', justifyContent: 'center', ...theme.shadowLg },
  photoWrap: { marginHorizontal: 16, marginBottom: 12, borderRadius: 20, overflow: 'hidden', ...theme.shadow },
  photo: { width: '100%', height: 200 },
  photoPlaceholder: { backgroundColor: theme.accentSubtle, alignItems: 'center', justifyContent: 'center' },
  actionsRow: { flexDirection: 'row', gap: 12, marginHorizontal: 16, marginBottom: 12 },
  actionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: theme.card, borderRadius: 14, paddingVertical: 12, ...theme.shadow },
  actionText: { fontSize: 15, fontWeight: '700', color: theme.accentDark },
  card: { marginHorizontal: 16, marginBottom: 12, backgroundColor: theme.card, borderRadius: 16, padding: 16, ...theme.shadow },
  sep: { height: StyleSheet.hairlineWidth, backgroundColor: theme.separator },
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
  consumptionHint: { fontSize: 13, color: theme.textSecondary, lineHeight: 18 },
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
});
