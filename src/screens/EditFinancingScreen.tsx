import React, { useCallback, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity,
  ActivityIndicator, Image, KeyboardAvoidingView, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { useTheme, Theme } from '../theme';
import { useResponsive } from '../hooks/useResponsive';
import { FinancingWithInstallments } from '../types';
import { financingService } from '../services/financingService';
import { imageService } from '../services/imageService';
import { CurrencyInput } from '../components/CurrencyInput';
import { RootStackParamList, TAB_BAR_BOTTOM_OFFSET } from '../navigation';
import { showAlert, showConfirm } from '../utils/dialogs';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Route = RouteProp<RootStackParamList, 'EditFinancing'>;

export const EditFinancingScreen: React.FC = () => {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const { contentStyle } = useResponsive();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const { financingId } = route.params;
  const [financing, setFinancing] = useState<FinancingWithInstallments | null>(null);
  const [loading, setLoading] = useState(true);
  const [carName, setCarName] = useState('');
  const [licensePlate, setLicensePlate] = useState('');
  const [bank, setBank] = useState('');
  const [vehicleCents, setVehicleCents] = useState(0);
  const [installmentCents, setInstallmentCents] = useState(0);
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useFocusEffect(useCallback(() => {
    financingService.getById(financingId).then(async f => {
      if (!f) return;
      setFinancing(f);
      setCarName(f.carName);
      setLicensePlate(f.licensePlate);
      setBank(f.bank);
      setVehicleCents(Math.round(f.vehicleValue * 100));
      const firstUnpaid = f.installments.find(i => !i.payment);
      setInstallmentCents(Math.round((firstUnpaid?.amount ?? f.installments[0]?.amount ?? 0) * 100));
      if (f.carPhotoPath) {
        const url = await imageService.getSignedUrl(f.carPhotoPath);
        setPhotoUrl(url);
      }
    }).catch(() => null).finally(() => setLoading(false));
  }, [financingId]));

  if (loading || !financing) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color={theme.accentDark} />
      </View>
    );
  }

  const paidCount = financing.installments.filter(i => i.payment).length;

  const pickPhoto = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7 });
    if (!result.canceled && result.assets[0]) setPhotoUri(result.assets[0].uri);
  };

  const save = async () => {
    const name = carName.trim();
    if (!name) { showAlert('Erro', 'Informe o nome do veículo.'); return; }
    if (installmentCents <= 0) { showAlert('Erro', 'Informe o valor da parcela.'); return; }

    setSaving(true);
    try {
      let carPhotoPath = financing.carPhotoPath;
      if (photoUri) {
        if (carPhotoPath) await imageService.remove(carPhotoPath).catch(() => null);
        carPhotoPath = await imageService.uploadCarPhoto(financingId, photoUri);
      }
      await financingService.update(financingId, {
        carName: name,
        licensePlate: licensePlate.trim().toUpperCase(),
        bank: bank.trim(),
        vehicleValue: vehicleCents / 100,
        installmentAmount: installmentCents / 100,
        carPhotoPath,
      });
      navigation.goBack();
    } catch (e: any) {
      showAlert('Erro ao salvar', e?.message ?? 'Tente novamente');
    } finally {
      setSaving(false);
    }
  };

  const remove = () => {
    showConfirm(
      'Excluir financiamento?',
      `"${financing.carName}" e todas as parcelas serão removidos permanentemente.`,
      'Excluir',
      async () => {
        try {
          if (financing.carPhotoPath) await imageService.remove(financing.carPhotoPath).catch(() => null);
          for (const i of financing.installments) {
            for (const p of i.payment?.receiptPaths ?? []) {
              await imageService.remove(p).catch(() => null);
            }
          }
          await financingService.remove(financingId);
          navigation.popToTop();
        } catch (e: any) {
          showAlert('Erro', e?.message ?? 'Tente novamente');
        }
      },
    );
  };

  const displayPhoto = photoUri ?? photoUrl;

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.container}>
      <ScrollView contentContainerStyle={[{ paddingTop: insets.top + 8, paddingBottom: TAB_BAR_BOTTOM_OFFSET + 20 }, contentStyle]} keyboardShouldPersistTaps="handled">
        <View style={styles.topBar}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={28} color={theme.accentDark} />
          </TouchableOpacity>
          <Text style={styles.topTitle}>Editar</Text>
          <View style={{ width: 36 }} />
        </View>

        <TouchableOpacity style={styles.photoBox} onPress={pickPhoto} activeOpacity={0.8}>
          {displayPhoto ? (
            <Image source={{ uri: displayPhoto }} style={styles.photo} />
          ) : (
            <>
              <Ionicons name="camera-outline" size={28} color={theme.accentDark} />
              <Text style={styles.photoHint}>Adicionar foto</Text>
            </>
          )}
        </TouchableOpacity>

        <View style={styles.card}>
          <TextInput style={styles.input} value={carName} onChangeText={setCarName} placeholder="Nome do veículo" placeholderTextColor={theme.textSecondary} />
          <View style={styles.sep} />
          <TextInput style={styles.input} value={licensePlate} onChangeText={t => setLicensePlate(t.toUpperCase())} placeholder="Placa" placeholderTextColor={theme.textSecondary} autoCapitalize="characters" />
          <View style={styles.sep} />
          <TextInput style={styles.input} value={bank} onChangeText={setBank} placeholder="Banco / financeira" placeholderTextColor={theme.textSecondary} />
        </View>

        <View style={styles.card}>
          <View style={styles.fieldRow}>
            <Text style={styles.fieldLabel}>Valor do veículo</Text>
            <CurrencyInput cents={vehicleCents} onChange={setVehicleCents} />
          </View>
          <View style={styles.sep} />
          <View style={styles.fieldRow}>
            <Text style={styles.fieldLabel}>Valor da parcela</Text>
            <CurrencyInput cents={installmentCents} onChange={setInstallmentCents} />
          </View>
        </View>
        <Text style={styles.hint}>O novo valor de parcela vale apenas para as não pagas ({financing.installments.length - paidCount}).</Text>

        <View style={styles.card}>
          <View style={styles.fieldRow}>
            <Text style={styles.fieldLabel}>Total de parcelas</Text>
            <Text style={styles.readOnly}>{financing.totalInstallments}</Text>
          </View>
          <View style={styles.sep} />
          <View style={styles.fieldRow}>
            <Text style={styles.fieldLabel}>Parcelas pagas</Text>
            <Text style={styles.readOnly}>{paidCount}</Text>
          </View>
        </View>

        <TouchableOpacity style={[styles.saveBtn, saving && { opacity: 0.6 }]} onPress={save} disabled={saving}>
          {saving ? <ActivityIndicator color="#000" /> : <Text style={styles.saveBtnText}>Salvar</Text>}
        </TouchableOpacity>

        <TouchableOpacity style={styles.deleteBtn} onPress={remove}>
          <Ionicons name="trash-outline" size={16} color={theme.spend} />
          <Text style={styles.deleteBtnText}>Excluir financiamento</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const makeStyles = (theme: Theme) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.bg },
  center: { alignItems: 'center', justifyContent: 'center' },
  topBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, marginBottom: 12 },
  backBtn: { padding: 4 },
  topTitle: { flex: 1, fontSize: 20, fontWeight: '800', color: theme.text, textAlign: 'center' },
  photoBox: {
    height: 130, marginHorizontal: 16, marginBottom: 12, borderRadius: 16,
    backgroundColor: theme.accentSubtle, borderWidth: 1.5, borderColor: theme.accentBorder,
    borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center', gap: 6, overflow: 'hidden',
  },
  photo: { width: '100%', height: '100%' },
  photoHint: { fontSize: 13, color: theme.accentDark, fontWeight: '600' },
  card: { marginHorizontal: 16, marginBottom: 12, backgroundColor: theme.card, borderRadius: 16, overflow: 'hidden', ...theme.shadow },
  input: { fontSize: 16, color: theme.text, paddingHorizontal: 16, paddingVertical: 14 },
  sep: { height: StyleSheet.hairlineWidth, backgroundColor: theme.separator, marginHorizontal: 16 },
  fieldRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, gap: 12 },
  fieldLabel: { fontSize: 14, color: theme.text, fontWeight: '500' },
  readOnly: { fontSize: 15, fontWeight: '600', color: theme.textSecondary, paddingVertical: 14 },
  hint: { fontSize: 12, color: theme.textTertiary, marginHorizontal: 20, marginTop: -6, marginBottom: 12 },
  saveBtn: { marginHorizontal: 16, backgroundColor: theme.accent, borderRadius: 16, paddingVertical: 16, alignItems: 'center', ...theme.shadowMd },
  saveBtnText: { fontSize: 16, fontWeight: '800', color: '#000' },
  deleteBtn: { flexDirection: 'row', gap: 6, alignSelf: 'center', alignItems: 'center', marginTop: 18, paddingHorizontal: 18, paddingVertical: 10, borderRadius: 12, backgroundColor: theme.spend + '14' },
  deleteBtnText: { fontSize: 14, fontWeight: '700', color: theme.spend },
});
