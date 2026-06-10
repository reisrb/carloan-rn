import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, Theme, formatBRL } from '../theme';
import { Installment, installmentStatus } from '../types';
import { STATUS_COLORS } from './StatusBadge';
import { formatDate } from '../utils/date';

const STATUS_ICONS = {
  paid: 'checkmark-circle' as const,
  open: 'ellipse-outline' as const,
  overdue: 'warning' as const,
};

interface Props {
  installment: Installment;
  onPress: () => void;
}

export const InstallmentRowItem: React.FC<Props> = ({ installment, onPress }) => {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const status = installmentStatus(installment);
  const color = STATUS_COLORS[status];

  return (
    <TouchableOpacity style={styles.row} onPress={onPress} activeOpacity={0.7}>
      <Ionicons name={STATUS_ICONS[status]} size={22} color={color} />
      <View style={styles.body}>
        <Text style={styles.number}>Parcela {installment.number}</Text>
        <Text style={styles.date}>{formatDate(installment.dueDate)}</Text>
      </View>
      <View style={styles.right}>
        <Text style={styles.amount}>{formatBRL(installment.amount)}</Text>
        <Text style={styles.balance}>Saldo {formatBRL(installment.remainingBalance)}</Text>
      </View>
    </TouchableOpacity>
  );
};

const makeStyles = (theme: Theme) => StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  body: { flex: 1, gap: 2 },
  number: { fontSize: 15, fontWeight: '600', color: theme.text },
  date: { fontSize: 12, color: theme.textSecondary },
  right: { alignItems: 'flex-end', gap: 2 },
  amount: { fontSize: 15, fontWeight: '700', color: theme.text },
  balance: { fontSize: 11, color: theme.textTertiary },
});
