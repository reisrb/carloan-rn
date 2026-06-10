import React, { useMemo } from 'react';
import { View, Text, TextInput, StyleSheet } from 'react-native';
import { useTheme, Theme } from '../theme';

interface Props {
  cents: number;
  onChange: (cents: number) => void;
  placeholder?: string;
}

export const CurrencyInput: React.FC<Props> = ({ cents, onChange, placeholder }) => {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  const format = (c: number) => {
    const whole = Math.floor(c / 100).toLocaleString('pt-BR');
    return `${whole},${String(c % 100).padStart(2, '0')}`;
  };

  const handleChange = (val: string) => {
    const digits = val.replace(/\D/g, '').slice(0, 9);
    onChange(parseInt(digits || '0', 10));
  };

  return (
    <View style={styles.row}>
      <Text style={styles.prefix}>R$</Text>
      <TextInput
        style={styles.input}
        value={cents > 0 ? format(cents) : ''}
        onChangeText={handleChange}
        keyboardType="numeric"
        placeholder={placeholder ?? '0,00'}
        placeholderTextColor={theme.textTertiary}
      />
    </View>
  );
};

const makeStyles = (theme: Theme) => StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  prefix: { fontSize: 16, fontWeight: '600', color: theme.textSecondary },
  input: { flex: 1, fontSize: 16, color: theme.text, paddingVertical: 14 },
});
