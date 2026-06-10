import React, { useMemo, useCallback, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { useFocusEffect } from '@react-navigation/native';
import { useTheme, Theme } from '../theme';
import { useResponsive } from '../hooks/useResponsive';
import { backupService } from '../services/backupService';
import { authService } from '../services/authService';
import { adminService, UserProfile } from '../services/adminService';
import { TAB_BAR_BOTTOM_OFFSET } from '../navigation';
import { showTabBar } from '../navigation/tabBarController';
import { AppearanceScreen } from './AppearanceScreen';
import { showAlert } from '../utils/dialogs';

export const ProfileScreen: React.FC = () => {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const { contentStyle } = useResponsive();
  const [importMsg, setImportMsg] = useState<string | null>(null);
  const [username, setUsername] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [pendingUsers, setPendingUsers] = useState<UserProfile[]>([]);
  const [showLogout, setShowLogout] = useState(false);
  const [showAppearance, setShowAppearance] = useState(false);

  useFocusEffect(useCallback(() => { showTabBar(); }, []));

  useEffect(() => {
    adminService.getMyProfile().then(p => {
      if (!p) return;
      setUsername(p.username);
      setIsAdmin(p.role === 'admin');
      if (p.role === 'admin') {
        adminService.getPendingUsers().then(setPendingUsers).catch(() => null);
      }
    }).catch(() => null);
  }, []);

  const handleExport = async () => {
    try {
      await backupService.share();
    } catch (e: any) {
      showAlert('Erro ao exportar', e?.message ?? 'Tente novamente');
    }
  };

  const handleImport = async () => {
    const result = await DocumentPicker.getDocumentAsync({ type: 'application/json' });
    if (result.canceled || !result.assets?.[0]) return;
    try {
      const { financings } = await backupService.importJson(result.assets[0].uri);
      setImportMsg(`${financings} financiamento${financings !== 1 ? 's' : ''} importado${financings !== 1 ? 's' : ''}`);
    } catch {
      showAlert('Erro', 'Formato de arquivo inválido.');
    }
  };

  const handleApprove = async (user: UserProfile) => {
    try {
      await adminService.approveUser(user.id);
      setPendingUsers(prev => prev.filter(u => u.id !== user.id));
    } catch (e: any) {
      showAlert('Erro ao aprovar', e?.message ?? 'Tente novamente');
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={[{ paddingBottom: TAB_BAR_BOTTOM_OFFSET + 20 }, contentStyle]}>
        <View style={styles.heroCard}>
          <View style={styles.heroIcon}>
            <Ionicons name="car-sport" size={32} color={theme.accentDark} />
          </View>
          <Text style={styles.heroTitle}>CarLoan</Text>
          {username && <Text style={styles.heroUser}>@{username}</Text>}
          <Text style={styles.heroSub}>Gestão de financiamento de veículos</Text>
          <TouchableOpacity style={styles.logoutBtn} onPress={() => setShowLogout(true)}>
            <Ionicons name="log-out-outline" size={15} color={theme.spend} />
            <Text style={styles.logoutText}>Sair</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.sectionHeader}>PERSONALIZAÇÃO</Text>
        <View style={styles.card}>
          <ActionRow
            icon="color-palette-outline" iconColor={theme.accentDark}
            title="Aparência" subtitle="Tema, cor de destaque e fundo"
            onPress={() => setShowAppearance(true)}
          />
        </View>

        <Text style={styles.sectionHeader}>DADOS</Text>
        <View style={styles.card}>
          <ActionRow
            icon="share-outline" iconColor={theme.orange}
            title="Exportar dados" subtitle="Gera um JSON com todos os financiamentos"
            onPress={handleExport}
          />
          <View style={styles.sep} />
          <ActionRow
            icon="download-outline" iconColor="#8B5CF6"
            title="Importar dados"
            subtitle={importMsg ?? 'Importar um JSON exportado pelo app'}
            subtitleColor={importMsg ? '#22C55E' : undefined}
            onPress={handleImport}
          />
        </View>

        {isAdmin && (
          <>
            <Text style={styles.sectionHeader}>ADMIN — USUÁRIOS PENDENTES</Text>
            <View style={styles.card}>
              {pendingUsers.length === 0 ? (
                <Text style={styles.emptyCard}>Nenhum usuário aguardando aprovação</Text>
              ) : (
                pendingUsers.map((u, idx) => (
                  <View key={u.id}>
                    {idx > 0 && <View style={styles.sep} />}
                    <View style={styles.pendingRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.pendingName}>@{u.username}</Text>
                        <Text style={styles.pendingMeta}>{u.email}</Text>
                      </View>
                      <TouchableOpacity style={styles.approveBtn} onPress={() => handleApprove(u)}>
                        <Text style={styles.approveBtnText}>Aprovar</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ))
              )}
            </View>
          </>
        )}
      </ScrollView>

      <Modal visible={showAppearance} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowAppearance(false)}>
        <View style={{ flex: 1, backgroundColor: theme.bg }}>
          <View style={[styles.card, { margin: 0, borderRadius: 0, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, paddingTop: 20, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: theme.border }]}>
            <Text style={{ fontSize: 17, fontWeight: '800', color: theme.text, flex: 1 }}>Aparência</Text>
            <TouchableOpacity onPress={() => setShowAppearance(false)}>
              <Ionicons name="close" size={24} color={theme.textSecondary} />
            </TouchableOpacity>
          </View>
          <AppearanceScreen />
        </View>
      </Modal>

      <Modal visible={showLogout} transparent animationType="fade" onRequestClose={() => setShowLogout(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.logoutModal}>
            <Text style={styles.logoutModalTitle}>Sair do app?</Text>
            <Text style={styles.logoutModalSub}>Você precisará fazer login novamente.</Text>
            <View style={styles.logoutModalBtns}>
              <TouchableOpacity style={styles.logoutModalCancel} onPress={() => setShowLogout(false)}>
                <Text style={styles.logoutModalCancelText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.logoutModalConfirm} onPress={() => authService.signOut()}>
                <Text style={styles.logoutModalConfirmText}>Sair</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const ActionRow: React.FC<{
  icon: React.ComponentProps<typeof Ionicons>['name'];
  iconColor: string;
  title: string;
  subtitle: string;
  subtitleColor?: string;
  onPress: () => void;
}> = ({ icon, iconColor, title, subtitle, subtitleColor, onPress }) => {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  return (
    <TouchableOpacity style={styles.actionRow} onPress={onPress} activeOpacity={0.7}>
      <View style={[styles.actionIcon, { backgroundColor: iconColor + '20' }]}>
        <Ionicons name={icon} size={20} color={iconColor} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.actionTitle}>{title}</Text>
        <Text style={[styles.actionSub, subtitleColor ? { color: subtitleColor } : {}]}>{subtitle}</Text>
      </View>
      <Ionicons name="chevron-forward" size={16} color={theme.textSecondary} />
    </TouchableOpacity>
  );
};

const makeStyles = (theme: Theme) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.bg },
  heroCard: { margin: 16, padding: 24, backgroundColor: theme.card, borderRadius: 20, alignItems: 'center', gap: 8, ...theme.shadowMd },
  heroIcon: { width: 72, height: 72, borderRadius: 36, backgroundColor: theme.accentSubtle, alignItems: 'center', justifyContent: 'center' },
  heroTitle: { fontSize: 22, fontWeight: '800', color: theme.text },
  heroUser: { fontSize: 14, fontWeight: '700', color: theme.accentDark },
  heroSub: { fontSize: 14, color: theme.textSecondary },
  logoutBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4, paddingHorizontal: 14, paddingVertical: 7, backgroundColor: theme.spend + '14', borderRadius: 20 },
  logoutText: { fontSize: 14, fontWeight: '700', color: theme.spend },
  sectionHeader: { fontSize: 12, fontWeight: '700', color: theme.textSecondary, marginHorizontal: 16, marginTop: 20, marginBottom: 8, letterSpacing: 0.5 },
  card: { marginHorizontal: 16, backgroundColor: theme.card, borderRadius: 16, overflow: 'hidden', ...theme.shadow },
  sep: { height: StyleSheet.hairlineWidth, backgroundColor: theme.separator, marginHorizontal: 16 },
  actionRow: { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 12 },
  actionIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  actionTitle: { fontSize: 15, fontWeight: '600', color: theme.text },
  actionSub: { fontSize: 12, color: theme.textSecondary },
  emptyCard: { padding: 20, textAlign: 'center', color: theme.textSecondary, fontSize: 14 },
  pendingName: { fontSize: 15, fontWeight: '600', color: theme.text },
  pendingMeta: { fontSize: 12, color: theme.textSecondary },
  pendingRow: { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 12 },
  approveBtn: { paddingHorizontal: 16, paddingVertical: 7, backgroundColor: theme.accentSubtle, borderRadius: 20, borderWidth: 1, borderColor: theme.accentBorder },
  approveBtnText: { fontSize: 13, fontWeight: '700', color: theme.accentDark },
  modalOverlay: { flex: 1, backgroundColor: '#00000070', alignItems: 'center', justifyContent: 'center', padding: 32 },
  logoutModal: { width: '100%', maxWidth: 400, backgroundColor: theme.card, borderRadius: 20, padding: 24, gap: 12 },
  logoutModalTitle: { fontSize: 18, fontWeight: '800', color: theme.text },
  logoutModalSub: { fontSize: 14, color: theme.textSecondary },
  logoutModalBtns: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12, marginTop: 4 },
  logoutModalCancel: { paddingHorizontal: 18, paddingVertical: 10, borderRadius: 12, backgroundColor: theme.bg },
  logoutModalCancelText: { fontSize: 15, fontWeight: '600', color: theme.textSecondary },
  logoutModalConfirm: { paddingHorizontal: 18, paddingVertical: 10, borderRadius: 12, backgroundColor: theme.spend + '18' },
  logoutModalConfirmText: { fontSize: 15, fontWeight: '700', color: theme.spend },
});
