import React, { useEffect, useMemo, useState } from 'react';
import { View, StyleSheet, Image, TouchableOpacity, Platform, ActivityIndicator, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, Theme } from '../theme';
import { imageService } from '../services/imageService';

interface Props {
  path: string;
  size?: number;
  /** When true, tapping opens the full receipt in a new tab / browser. */
  openable?: boolean;
}

export const ReceiptThumb: React.FC<Props> = ({ path, size = 72, openable = false }) => {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    imageService.getOrCachePhoto(path).then(u => { if (active) setUrl(u); });
    return () => { active = false; };
  }, [path]);

  const open = async () => {
    const signed = await imageService.getSignedUrl(path);
    if (!signed) return;
    if (Platform.OS === 'web') window.open(signed, '_blank');
    else Linking.openURL(signed).catch(() => null);
  };

  const content = url ? (
    <Image source={{ uri: url }} style={[styles.thumb, { width: size, height: size }]} />
  ) : (
    <View style={[styles.thumb, styles.placeholder, { width: size, height: size }]}>
      <ActivityIndicator size="small" color={theme.accentDark} />
    </View>
  );

  if (!openable) return content;
  return (
    <TouchableOpacity onPress={open} activeOpacity={0.8}>
      {content}
      <View style={styles.badge}><Ionicons name="expand-outline" size={12} color="#fff" /></View>
    </TouchableOpacity>
  );
};

const makeStyles = (theme: Theme) => StyleSheet.create({
  thumb: { borderRadius: 12, backgroundColor: theme.separator },
  placeholder: { alignItems: 'center', justifyContent: 'center' },
  badge: { position: 'absolute', bottom: 4, right: 4, backgroundColor: '#00000080', borderRadius: 8, padding: 2 },
});
