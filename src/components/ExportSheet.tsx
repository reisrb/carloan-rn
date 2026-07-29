import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, Theme } from '../theme';
import { exportHtmlAsPdf } from '../utils/pdf';
import { sendReportByEmail } from '../services/emailService';
import { showAlert } from '../utils/dialogs';

// Flip to true once the Resend domain (carloan.com) is DNS-verified.
const EMAIL_ENABLED = false;

interface Props {
  visible: boolean;
  html: string;
  title: string;
  onClose: () => void;
}

export const ExportSheet: React.FC<Props> = ({ visible, html, title, onClose }) => {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const [sending, setSending] = useState(false);

  const download = async () => {
    try { await exportHtmlAsPdf(html, title); onClose(); }
    catch (e: any) { showAlert('Erro', e?.message ?? 'Não foi possível exportar'); }
  };

  const email = async () => {
    setSending(true);
    try {
      const to = await sendReportByEmail(html, title);
      onClose();
      showAlert('Enviado', `Relatório enviado para ${to || 'seu e-mail'}.`);
    } catch (e: any) {
      showAlert('Erro ao enviar', e?.message ?? 'Tente novamente');
    } finally {
      setSending(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity activeOpacity={1} style={styles.sheet}>
          <Text style={styles.title}>Exportar relatório</Text>

          <TouchableOpacity style={styles.opt} onPress={download} disabled={sending}>
            <Ionicons name="download-outline" size={22} color={theme.accentDark} />
            <Text style={styles.optText}>Baixar PDF</Text>
          </TouchableOpacity>

          {EMAIL_ENABLED && (
            <TouchableOpacity style={styles.opt} onPress={email} disabled={sending}>
              {sending
                ? <ActivityIndicator size="small" color={theme.accentDark} />
                : <Ionicons name="mail-outline" size={22} color={theme.accentDark} />}
              <Text style={styles.optText}>Enviar por e-mail</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity style={styles.cancel} onPress={onClose} disabled={sending}>
            <Text style={styles.cancelText}>Cancelar</Text>
          </TouchableOpacity>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
};

const makeStyles = (theme: Theme) => StyleSheet.create({
  overlay: { flex: 1, backgroundColor: '#00000070', alignItems: 'center', justifyContent: 'center', padding: 28 },
  sheet: { width: '100%', maxWidth: 380, backgroundColor: theme.card, borderRadius: 20, padding: 20, gap: 10 },
  title: { fontSize: 17, fontWeight: '800', color: theme.text, marginBottom: 4 },
  opt: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, paddingHorizontal: 14, borderRadius: 14, backgroundColor: theme.bg },
  optText: { fontSize: 16, fontWeight: '700', color: theme.text },
  cancel: { alignItems: 'center', paddingVertical: 12, marginTop: 2 },
  cancelText: { fontSize: 15, fontWeight: '600', color: theme.textSecondary },
});
