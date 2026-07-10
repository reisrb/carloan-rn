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
import { sharingService, FinancingMember } from '../services/sharingService';
import { RootStackParamList, TAB_BAR_BOTTOM_OFFSET } from '../navigation';
import { showAlert, showConfirm } from '../utils/dialogs';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Route = RouteProp<RootStackParamList, 'EditCar'>;

export const EditCarScreen: React.FC = () => {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const { contentStyle } = useResponsive();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const { financingId } = route.params;

  const [car, setCar] = useState<FinancingWithInstallments | null>(null);
  const [loading, setLoading] = useState(true);
  const [carName, setCarName] = useState('');
  const [licensePlate, setLicensePlate] = useState('');
  const [brand, setBrand] = useState('');
  const [model, setModel] = useState('');
  const [year, setYear] = useState('');
  const [color, setColor] = useState('');
  const [kmText, setKmText] = useState('');
  const [tankLitersText, setTankLitersText] = useState('');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [members, setMembers] = useState<FinancingMember[]>([]);

  useFocusEffect(useCallback(() => {
    Promise.all([financingService.getById(financingId), sharingService.getMembers(financingId)])
      .then(async ([f, mbrs]) => {
        if (!f) return;
        setCar(f); setMembers(mbrs);
        setCarName(f.carName); setLicensePlate(f.licensePlate);
        setBrand(f.brand ?? ''); setModel(f.model ?? '');
        setYear(f.year != null ? String(f.year) : ''); setColor(f.color ?? '');
        setKmText(String(f.currentKm)); setTankLitersText(f.tankLiters != null ? String(f.tankLiters) : '');
        if (f.carPhotoPath) setPhotoUrl(await imageService.getSignedUrl(f.carPhotoPath));
      })
      .catch(() => null)
      .finally(() => setLoading(false));
  }, [financingId]));

  if (loading || !car) {
    return <View style={[styles.container, styles.center]}><ActivityIndicator size="large" color={theme.accentDark} /></View>;
  }

  const pickPhoto = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });
    if (!result.canceled && result.assets[0]) setPhotoUri(result.assets[0].uri);
  };

  const save = async () => {
    const name = carName.trim();
    if (!name) { showAlert('Erro', 'Informe o nome do veículo.'); return; }
    setSaving(true);
    try {
      let carPhotoPath = car.carPhotoPath;
      if (photoUri) {
        if (carPhotoPath) await imageService.remove(carPhotoPath).catch(() => null);
        carPhotoPath = await imageService.uploadCarPhoto(financingId, photoUri);
      }
      await financingService.updateCar(financingId, {
        carName: name,
        licensePlate: licensePlate.trim().toUpperCase(),
        brand: brand.trim() || null,
        model: model.trim() || null,
        year: parseInt(year, 10) || null,
        color: color.trim() || null,
        currentKm: parseInt(kmText.replace(/\D/g, ''), 10) || 0,
        monthlyCost: car.monthlyCost,
        tankLiters: parseFloat(tankLitersText.replace(',', '.')) || null,
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
    showConfirm('Excluir carro?', `"${car.carName}" e todos os dados serão removidos permanentemente.`, 'Excluir', async () => {
      try {
        if (car.carPhotoPath) await imageService.remove(car.carPhotoPath).catch(() => null);
        await financingService.remove(financingId);
        navigation.popToTop();
      } catch (e: any) {
        showAlert('Erro', e?.message ?? 'Tente novamente');
      }
    });
  };

  const displayPhoto = photoUri ?? photoUrl;

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.container}>
      <ScrollView contentContainerStyle={[{ paddingTop: insets.top + 8, paddingBottom: TAB_BAR_BOTTOM_OFFSET + 20 }, contentStyle]} keyboardShouldPersistTaps="handled">
        <View style={styles.topBar}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={28} color={theme.accentDark} />
          </TouchableOpacity>
          <Text style={styles.topTitle}>Editar carro</Text>
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
        </View>

        <Text style={styles.sectionHeader}>FICHA</Text>
        <View style={styles.card}>
          <TextInput style={styles.input} value={brand} onChangeText={setBrand} placeholder="Marca" placeholderTextColor={theme.textSecondary} />
          <View style={styles.sep} />
          <TextInput style={styles.input} value={model} onChangeText={setModel} placeholder="Modelo" placeholderTextColor={theme.textSecondary} />
          <View style={styles.sep} />
          <TextInput style={styles.input} value={year} onChangeText={t => setYear(t.replace(/\D/g, '').slice(0, 4))} placeholder="Ano" placeholderTextColor={theme.textSecondary} keyboardType="numeric" />
          <View style={styles.sep} />
          <TextInput style={styles.input} value={color} onChangeText={setColor} placeholder="Cor" placeholderTextColor={theme.textSecondary} />
        </View>

        <Text style={styles.sectionHeader}>USO</Text>
        <View style={styles.card}>
          <View style={styles.fieldRow}>
            <Text style={styles.fieldLabel}>Quilometragem atual</Text>
            <TextInput style={styles.inlineInput} value={kmText} onChangeText={t => setKmText(t.replace(/\D/g, '').slice(0, 7))} keyboardType="numeric" placeholder="0" placeholderTextColor={theme.textTertiary} />
          </View>
          <View style={styles.sep} />
          <View style={styles.fieldRow}>
            <Text style={styles.fieldLabel}>Litros do tanque</Text>
            <TextInput style={styles.inlineInput} value={tankLitersText} onChangeText={setTankLitersText} keyboardType="decimal-pad" placeholder="opcional" placeholderTextColor={theme.textTertiary} />
          </View>
        </View>

        {members.length > 0 && (
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
                  <Text style={styles.memberPerm}>{m.permission === 'edit' ? 'editar' : 'ver'}</Text>
                </View>
              </View>
            ))}
          </View>
        )}

        <TouchableOpacity style={[styles.saveBtn, saving && { opacity: 0.6 }]} onPress={save} disabled={saving}>
          {saving ? <ActivityIndicator color="#000" /> : <Text style={styles.saveBtnText}>Salvar</Text>}
        </TouchableOpacity>

        <TouchableOpacity style={styles.deleteBtn} onPress={remove}>
          <Ionicons name="trash-outline" size={16} color={theme.spend} />
          <Text style={styles.deleteBtnText}>Excluir carro</Text>
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
  sectionHeader: { fontSize: 12, fontWeight: '700', color: theme.textSecondary, marginHorizontal: 20, marginBottom: 6, letterSpacing: 0.5 },
  fieldRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, gap: 12 },
  fieldLabel: { fontSize: 14, color: theme.text, fontWeight: '500' },
  inlineInput: { fontSize: 16, color: theme.text, paddingVertical: 14, minWidth: 110, textAlign: 'right' },
  saveBtn: { marginHorizontal: 16, backgroundColor: theme.accent, borderRadius: 16, paddingVertical: 16, alignItems: 'center', ...theme.shadowMd },
  saveBtnText: { fontSize: 16, fontWeight: '800', color: '#000' },
  deleteBtn: { flexDirection: 'row', gap: 6, alignSelf: 'center', alignItems: 'center', marginTop: 18, paddingHorizontal: 18, paddingVertical: 10, borderRadius: 12, backgroundColor: theme.spend + '14' },
  deleteBtnText: { fontSize: 14, fontWeight: '700', color: theme.spend },
  membersTitle: { fontSize: 11, fontWeight: '700', letterSpacing: 0.5, color: theme.textSecondary, textTransform: 'uppercase', margin: 16, marginBottom: 8 },
  memberRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, paddingHorizontal: 16 },
  memberAvatar: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  memberUsername: { fontSize: 14, fontWeight: '600', color: theme.text, flex: 1 },
  memberPerm: { fontSize: 12, fontWeight: '600', color: theme.textSecondary },
});
