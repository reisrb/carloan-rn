import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ActivityIndicator, Alert, ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, Theme } from '../theme';
import { useResponsive } from '../hooks/useResponsive';
import { authService } from '../services/authService';
import { realtimeService } from '../services/realtimeService';

type Screen = 'login' | 'register' | 'pending' | 'approved';

export const AuthScreen: React.FC = () => {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const { contentStyle } = useResponsive();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [screen, setScreen] = useState<Screen>('login');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const unsubRef = useRef<(() => void) | null>(null);

  useEffect(() => () => { unsubRef.current?.(); }, []);

  const resetToLogin = () => {
    unsubRef.current?.();
    unsubRef.current = null;
    setScreen('login');
    setMode('login');
    setUsername(''); setEmail(''); setPassword('');
    setErrorMsg(null);
  };

  const startPendingWatch = async (identifier: string) => {
    const profileId = await realtimeService.getProfileIdByIdentifier(identifier);
    if (!profileId) return;
    unsubRef.current?.();
    unsubRef.current = realtimeService.watchProfileStatus(profileId, () => {
      setScreen('approved');
    });
  };

  const handle = async () => {
    const u = username.trim();
    const e = email.trim();
    const p = password;

    if (!u || !p || (mode === 'register' && !e)) {
      Alert.alert('Campos obrigatórios', 'Preencha todos os campos.');
      return;
    }

    setLoading(true);
    setErrorMsg(null);
    try {
      if (mode === 'register') {
        await authService.signUp(u, e, p);
        unsubRef.current?.();
        unsubRef.current = null;
        setScreen('login');
        setMode('login');
        setEmail('');
        setErrorMsg(null);
        Alert.alert('Conta criada!', 'Sua conta foi criada e aguarda aprovação de um administrador. Você será notificado quando sua conta for aprovada. Faça login para continuar.');
      } else {
        await authService.signIn(u, p);
      }
    } catch (err: any) {
      const msg: string = err.message ?? 'Erro desconhecido';
      setErrorMsg(msg);
      if (msg.includes('aguardando aprovação')) startPendingWatch(u);
    } finally {
      setLoading(false);
    }
  };

  if (screen === 'pending') {
    return (
      <View style={styles.container}>
        <View style={styles.successBox}>
          <ActivityIndicator size="large" color={theme.accentDark} style={{ marginBottom: 8 }} />
          <Text style={styles.successTitle}>Aguardando aprovação</Text>
          <Text style={styles.successText}>
            Sua conta foi criada e está aguardando aprovação de um administrador.
          </Text>
          <Text style={styles.successSub}>
            Você será notificado automaticamente quando sua conta for aprovada.
          </Text>
          <TouchableOpacity style={[styles.backBtn, { backgroundColor: theme.card, marginTop: 8 }]} onPress={resetToLogin}>
            <Text style={[styles.backBtnText, { color: theme.textSecondary }]}>Voltar para o login</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (screen === 'approved') {
    return (
      <View style={styles.container}>
        <View style={styles.successBox}>
          <Ionicons name="checkmark-circle" size={64} color={theme.accentDark} />
          <Text style={styles.successTitle}>Conta aprovada!</Text>
          <Text style={styles.successText}>
            Sua conta foi aprovada. Você já pode entrar no app.
          </Text>
          <TouchableOpacity style={styles.backBtn} onPress={resetToLogin}>
            <Text style={styles.backBtnText}>Fazer login</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={[styles.inner, contentStyle]} keyboardShouldPersistTaps="handled">
        <View style={styles.logoBox}>
          <Text style={styles.logoEmoji}>🚗</Text>
          <Text style={styles.logoTitle}>CarLoan</Text>
          <Text style={styles.logoSub}>Gestão de financiamento de veículos</Text>
        </View>

        <View style={styles.card}>
          <View style={styles.segControl}>
            <TouchableOpacity
              style={[styles.seg, mode === 'login' && styles.segActive]}
              onPress={() => { setMode('login'); setScreen('login'); }}
            >
              <Text style={[styles.segText, mode === 'login' && styles.segTextActive]}>Entrar</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.seg, mode === 'register' && styles.segActive]}
              onPress={() => { setMode('register'); setScreen('register'); }}
            >
              <Text style={[styles.segText, mode === 'register' && styles.segTextActive]}>Criar conta</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.fields}>
            <TextInput
              style={styles.input}
              value={username}
              onChangeText={v => { setUsername(v); setErrorMsg(null); }}
              autoCapitalize="none"
              autoCorrect={false}
              placeholder={mode === 'register' ? 'Username' : 'Username ou email'}
              placeholderTextColor={theme.textSecondary}
              returnKeyType="next"
            />

            {mode === 'register' && (
              <>
                <View style={styles.divider} />
                <TextInput
                  style={styles.input}
                  value={email}
                  onChangeText={v => { setEmail(v); setErrorMsg(null); }}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="email-address"
                  placeholder="seu@email.com"
                  placeholderTextColor={theme.textSecondary}
                  returnKeyType="next"
                />
              </>
            )}

            <View style={styles.divider} />
            <TextInput
              style={styles.input}
              value={password}
              onChangeText={v => { setPassword(v); setErrorMsg(null); }}
              secureTextEntry
              placeholder={mode === 'register' ? 'Senha (mín. 6 caracteres)' : '••••••'}
              placeholderTextColor={theme.textSecondary}
              returnKeyType="done"
              onSubmitEditing={handle}
            />
          </View>
        </View>

        <TouchableOpacity
          style={[styles.btn, loading && styles.btnDisabled]}
          onPress={handle}
          disabled={loading}
          activeOpacity={0.85}
        >
          {loading
            ? <ActivityIndicator color="#000" />
            : <Text style={styles.btnText}>{mode === 'login' ? 'Entrar' : 'Criar conta'}</Text>
          }
        </TouchableOpacity>

        {errorMsg && (
          <View style={styles.errorBox}>
            <Ionicons name="alert-circle" size={16} color="#e53e3e" style={{ marginTop: 1 }} />
            <Text style={styles.errorText}>{errorMsg}</Text>
          </View>
        )}

        {mode === 'login' && (
          <Text style={styles.hint}>
            Não tem conta?{' '}
            <Text style={styles.hintLink} onPress={() => { setMode('register'); setScreen('register'); }}>
              Criar agora
            </Text>
          </Text>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const makeStyles = (theme: Theme) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.bg },
  inner: { flexGrow: 1, padding: 24, justifyContent: 'center', gap: 16 },
  logoBox: { alignItems: 'center', gap: 6, marginBottom: 16 },
  logoEmoji: { fontSize: 52 },
  logoTitle: { fontSize: 30, fontWeight: '900', color: theme.text },
  logoSub: { fontSize: 14, color: theme.textSecondary },
  card: { backgroundColor: theme.card, borderRadius: 20, overflow: 'hidden', ...theme.shadowMd },
  segControl: { flexDirection: 'row', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.border },
  seg: { flex: 1, paddingVertical: 14, alignItems: 'center' },
  segActive: { borderBottomWidth: 2, borderBottomColor: theme.accentDark },
  segText: { fontSize: 15, fontWeight: '600', color: theme.textSecondary },
  segTextActive: { color: theme.accentDark },
  fields: { paddingVertical: 4 },
  input: { fontSize: 16, color: theme.text, paddingHorizontal: 20, paddingVertical: 16 },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: theme.separator, marginHorizontal: 16 },
  btn: { backgroundColor: theme.accent, borderRadius: 16, paddingVertical: 17, alignItems: 'center', ...theme.shadowMd },
  btnDisabled: { opacity: 0.6 },
  btnText: { fontSize: 17, fontWeight: '800', color: '#000' },
  hint: { textAlign: 'center', fontSize: 14, color: theme.textSecondary },
  hintLink: { color: theme.accentDark, fontWeight: '700' },
  errorBox: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, backgroundColor: 'rgba(229,62,62,0.08)', borderRadius: 12, padding: 12 },
  errorText: { flex: 1, fontSize: 14, color: '#e53e3e', lineHeight: 20 },
  successBox: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 16 },
  successTitle: { fontSize: 24, fontWeight: '800', color: theme.text },
  successText: { fontSize: 15, color: theme.textSecondary, textAlign: 'center', lineHeight: 22 },
  successSub: { fontSize: 13, color: theme.textSecondary, textAlign: 'center', lineHeight: 20 },
  backBtn: { marginTop: 8, backgroundColor: theme.accent, borderRadius: 14, paddingHorizontal: 28, paddingVertical: 14 },
  backBtnText: { fontSize: 16, fontWeight: '800', color: '#000' },
});
