import React, { useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, Modal, ScrollView, TextInput, TouchableOpacity,
  ActivityIndicator, Image, KeyboardAvoidingView, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useTheme, Theme } from '../theme';
import { useResponsive } from '../hooks/useResponsive';
import { financingService } from '../services/financingService';
import { imageService } from '../services/imageService';
import { showAlert } from '../utils/dialogs';

interface Props {
  visible: boolean;
  onClose: () => void;
  onCreated: () => void;
}

export const AddCarSheet: React.FC<Props> = ({ visible, onClose, onCreated }) => {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const { contentStyle } = useResponsive();

  const [carName, setCarName] = useState('');
  const [licensePlate, setLicensePlate] = useState('');
  const [brand, setBrand] = useState('');
  const [model, setModel] = useState('');
  const [year, setYear] = useState('');
  const [color, setColor] = useState('');
  const [kmText, setKmText] = useState('');
  const [tankLitersText, setTankLitersText] = useState('');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const reset = () => {
    setCarName(''); setLicensePlate(''); setBrand(''); setModel('');
    setYear(''); setColor(''); setKmText(''); setTankLitersText(''); setPhotoUri(null);
  };

  const pickPhoto = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });
    if (!result.canceled && result.assets[0]) setPhotoUri(result.assets[0].uri);
  };

  const save = async () => {
    const name = carName.trim();
    if (!name) { showAlert('Erro', 'Informe o nome do veículo.'); return; }

    setSaving(true);
    try {
      const id = await financingService.createCar({
        carName: name,
        licensePlate: licensePlate.trim().toUpperCase(),
        brand: brand.trim() || null,
        model: model.trim() || null,
        year: parseInt(year, 10) || null,
        color: color.trim() || null,
        currentKm: parseInt(kmText.replace(/\D/g, ''), 10) || 0,
        monthlyCost: 0,
        tankLiters: parseFloat(tankLitersText.replace(',', '.')) || null,
        carPhotoPath: null,
      });

      if (photoUri) {
        try {
          const path = await imageService.uploadCarPhoto(id, photoUri);
          await financingService.updateCar(id, {
            carName: name,
            licensePlate: licensePlate.trim().toUpperCase(),
            brand: brand.trim() || null,
            model: model.trim() || null,
            year: parseInt(year, 10) || null,
            color: color.trim() || null,
            currentKm: parseInt(kmText.replace(/\D/g, ''), 10) || 0,
            monthlyCost: 0,
            tankLiters: parseFloat(tankLitersText.replace(',', '.')) || null,
            carPhotoPath: path,
          });
        } catch { /* photo is best-effort */ }
      }

      reset();
      onCreated();
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
          <Text style={styles.headerTitle}>Novo carro</Text>
          <TouchableOpacity onPress={() => { reset(); onClose(); }}>
            <Ionicons name="close" size={24} color={theme.textSecondary} />
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={[styles.body, contentStyle]} keyboardShouldPersistTaps="handled">
          <TouchableOpacity style={styles.photoBox} onPress={pickPhoto} activeOpacity={0.8}>
            {photoUri ? (
              <Image source={{ uri: photoUri }} style={styles.photo} />
            ) : (
              <>
                <Ionicons name="camera-outline" size={28} color={theme.accentDark} />
                <Text style={styles.photoHint}>Foto do veículo (opcional)</Text>
              </>
            )}
          </TouchableOpacity>

          <View style={styles.card}>
            <TextInput style={styles.input} value={carName} onChangeText={setCarName} placeholder="Nome do veículo *" placeholderTextColor={theme.textSecondary} />
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

          <Text style={styles.sectionHeader}>CUSTOS</Text>
          <View style={styles.card}>
            <View style={styles.fieldRow}>
              <Text style={styles.fieldLabel}>Quilometragem atual</Text>
              <TextInput
                style={styles.inlineInput}
                value={kmText}
                onChangeText={t => setKmText(t.replace(/\D/g, '').slice(0, 7))}
                keyboardType="numeric"
                placeholder="0"
                placeholderTextColor={theme.textTertiary}
              />
            </View>
            <View style={styles.sep} />
            <View style={styles.fieldRow}>
              <Text style={styles.fieldLabel}>Litros do tanque</Text>
              <TextInput
                style={styles.inlineInput}
                value={tankLitersText}
                onChangeText={setTankLitersText}
                keyboardType="decimal-pad"
                placeholder="opcional"
                placeholderTextColor={theme.textTertiary}
              />
            </View>
          </View>

          <TouchableOpacity style={[styles.saveBtn, saving && { opacity: 0.6 }]} onPress={save} disabled={saving}>
            {saving ? <ActivityIndicator color="#000" /> : <Text style={styles.saveBtnText}>Adicionar carro</Text>}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const makeStyles = (theme: Theme) => StyleSheet.create({
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: 16, paddingTop: 20, backgroundColor: theme.card,
    borderBottomWidth: StyleSheet.hairlineWidth, borderColor: theme.border,
  },
  headerTitle: { fontSize: 17, fontWeight: '800', color: theme.text },
  body: { padding: 16, gap: 12, paddingBottom: 40 },
  photoBox: {
    height: 110, borderRadius: 16, backgroundColor: theme.accentSubtle,
    borderWidth: 1.5, borderColor: theme.accentBorder, borderStyle: 'dashed',
    alignItems: 'center', justifyContent: 'center', gap: 6, overflow: 'hidden',
  },
  photo: { width: '100%', height: '100%' },
  photoHint: { fontSize: 13, color: theme.accentDark, fontWeight: '600' },
  card: { backgroundColor: theme.card, borderRadius: 16, overflow: 'hidden', ...theme.shadow },
  input: { fontSize: 16, color: theme.text, paddingHorizontal: 16, paddingVertical: 14 },
  sep: { height: StyleSheet.hairlineWidth, backgroundColor: theme.separator, marginHorizontal: 16 },
  sectionHeader: { fontSize: 12, fontWeight: '700', color: theme.textSecondary, marginTop: 8, marginBottom: -4, letterSpacing: 0.5 },
  fieldRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, gap: 12 },
  fieldLabel: { fontSize: 14, color: theme.text, fontWeight: '500' },
  inlineInput: { fontSize: 16, color: theme.text, paddingVertical: 14, minWidth: 110, textAlign: 'right' },
  saveBtn: { backgroundColor: theme.accent, borderRadius: 16, paddingVertical: 16, alignItems: 'center', marginTop: 8, ...theme.shadowMd },
  saveBtnText: { fontSize: 16, fontWeight: '800', color: '#000' },
});
