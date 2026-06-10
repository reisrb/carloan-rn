import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { InstallmentStatus } from '../types';

export const STATUS_COLORS: Record<InstallmentStatus, string> = {
  paid: '#22C55E',
  open: '#60A5FA',
  overdue: '#FF3B30',
};

export const STATUS_LABELS: Record<InstallmentStatus, string> = {
  paid: 'Paga',
  open: 'Em aberto',
  overdue: 'Vencida',
};

export const StatusBadge: React.FC<{ status: InstallmentStatus }> = ({ status }) => (
  <View style={[styles.badge, { backgroundColor: STATUS_COLORS[status] + '22' }]}>
    <Text style={[styles.text, { color: STATUS_COLORS[status] }]}>{STATUS_LABELS[status]}</Text>
  </View>
);

const styles = StyleSheet.create({
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  text: { fontSize: 12, fontWeight: '700' },
});
