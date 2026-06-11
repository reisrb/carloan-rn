import React, { useEffect, useMemo, useState } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Session } from '@supabase/supabase-js';
import { supabase } from './src/lib/supabase';
import { ThemeProvider } from './src/contexts/ThemeContext';
import { AppNavigator } from './src/navigation';
import { AuthScreen } from './src/screens/AuthScreen';
import { InstallBanner } from './src/components/InstallBanner';
import { useTheme, Theme } from './src/theme';

function Inner() {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const [session, setSession] = useState<Session | null | undefined>(undefined);

  useEffect(() => {
    const resolveSession = async (session: Session | null) => {
      if (!session) { setSession(null); return; }
      const { data: profile } = await supabase
        .from('profiles')
        .select('status')
        .eq('id', session.user.id)
        .maybeSingle();
      if (profile?.status === 'pending') {
        await supabase.auth.signOut();
        setSession(null);
      } else {
        setSession(session);
      }
    };

    supabase.auth.getSession().then(({ data: { session } }) => resolveSession(session));

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      resolveSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (session === undefined) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={theme.accentDark} />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: theme.bg }}>
      <SafeAreaProvider>
        <StatusBar style="auto" />
        {session ? <AppNavigator /> : <AuthScreen />}
        <InstallBanner />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <Inner />
    </ThemeProvider>
  );
}

const makeStyles = (theme: Theme) => StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.bg,
  },
});
