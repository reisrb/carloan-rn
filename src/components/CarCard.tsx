import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, Theme } from '../theme';
import { Financing, hasFinancing } from '../types';
import { imageService } from '../services/imageService';

interface Props {
  car: Financing;
  paidCount: number;
  onPress: () => void;
  ownerUsername?: string;
}

export const CarCard: React.FC<Props> = ({ car, paidCount, onPress, ownerUsername }) => {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    if (car.carPhotoPath) {
      imageService.getOrCachePhoto(car.carPhotoPath).then(url => { if (active) setPhotoUrl(url); });
    } else {
      setPhotoUrl(null);
    }
    return () => { active = false; };
  }, [car.carPhotoPath]);

  const financed = hasFinancing(car);
  const progress = financed ? paidCount / car.totalInstallments : 0;
  const subtitle = [car.brand, car.model].filter(Boolean).join(' ') || (financed ? car.bank : null);

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.8}>
      {photoUrl ? (
        <Image source={{ uri: photoUrl }} style={styles.photo} />
      ) : (
        <View style={[styles.photo, styles.photoPlaceholder]}>
          <Ionicons name="car-sport" size={28} color={theme.accentDark} />
        </View>
      )}
      <View style={styles.body}>
        <View style={styles.titleRow}>
          <Text style={styles.name} numberOfLines={1}>{car.carName}</Text>
          {ownerUsername ? (
            <View style={styles.ownerBadge}>
              <Ionicons name="person" size={10} color={theme.accentDark} />
              <Text style={styles.ownerText}>{ownerUsername}</Text>
            </View>
          ) : car.licensePlate ? (
            <View style={styles.plateBadge}>
              <Text style={styles.plateText}>{car.licensePlate}</Text>
            </View>
          ) : null}
        </View>
        {subtitle && !ownerUsername ? <Text style={styles.subtitle} numberOfLines={1}>{subtitle}</Text> : null}
        {financed ? (
          <View style={styles.progressRow}>
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
            </View>
            <Text style={styles.progressText}>{paidCount}/{car.totalInstallments}</Text>
          </View>
        ) : (
          <Text style={styles.kmText}>{car.currentKm.toLocaleString('pt-BR')} km</Text>
        )}
      </View>
      <Ionicons name="chevron-forward" size={18} color={theme.textTertiary} />
    </TouchableOpacity>
  );
};

const makeStyles = (theme: Theme) => StyleSheet.create({
  card: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: theme.card, borderRadius: 16, padding: 14,
    marginHorizontal: 16, marginBottom: 10, ...theme.shadow,
  },
  photo: { width: 56, height: 56, borderRadius: 14 },
  photoPlaceholder: { backgroundColor: theme.accentSubtle, alignItems: 'center', justifyContent: 'center' },
  body: { flex: 1, gap: 4 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  name: { fontSize: 16, fontWeight: '700', color: theme.text, flexShrink: 1 },
  plateBadge: { backgroundColor: theme.bg, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2, borderWidth: 1, borderColor: theme.border },
  plateText: { fontSize: 11, fontWeight: '700', color: theme.textSecondary, letterSpacing: 0.5 },
  ownerBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: theme.accentSubtle, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  ownerText: { fontSize: 11, fontWeight: '700', color: theme.accentDark },
  subtitle: { fontSize: 13, color: theme.textSecondary },
  kmText: { fontSize: 13, fontWeight: '600', color: theme.textSecondary, marginTop: 2 },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2 },
  progressBar: { flex: 1, height: 5, borderRadius: 3, backgroundColor: theme.separator, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 3, backgroundColor: theme.accentDark },
  progressText: { fontSize: 12, fontWeight: '600', color: theme.textSecondary },
});
