import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, Theme } from '../theme';
import { Financing } from '../types';

interface Props {
  financing: Financing;
  paidCount: number;
  onPress: () => void;
  photoUrl?: string | null;
  ownerUsername?: string;
}

export const FinancingCard: React.FC<Props> = ({ financing, paidCount, onPress, photoUrl, ownerUsername }) => {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  const progress = financing.totalInstallments > 0 ? paidCount / financing.totalInstallments : 0;

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
          <Text style={styles.name} numberOfLines={1}>{financing.carName}</Text>
          {ownerUsername ? (
            <View style={styles.ownerBadge}>
              <Ionicons name="person" size={10} color={theme.accentDark} />
              <Text style={styles.ownerText}>{ownerUsername}</Text>
            </View>
          ) : financing.licensePlate ? (
            <View style={styles.plateBadge}>
              <Text style={styles.plateText}>{financing.licensePlate}</Text>
            </View>
          ) : null}
        </View>
        {financing.bank ? <Text style={styles.bank}>{financing.bank}</Text> : null}
        <View style={styles.progressRow}>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
          </View>
          <Text style={styles.progressText}>{paidCount}/{financing.totalInstallments}</Text>
        </View>
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
  bank: { fontSize: 13, color: theme.textSecondary },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2 },
  progressBar: { flex: 1, height: 5, borderRadius: 3, backgroundColor: theme.separator, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 3, backgroundColor: theme.accentDark },
  progressText: { fontSize: 12, fontWeight: '600', color: theme.textSecondary },
});
