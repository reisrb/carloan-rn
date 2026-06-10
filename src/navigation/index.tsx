import React, { useMemo, useEffect, useState } from 'react';
import { TouchableOpacity, Text, StyleSheet, Animated, Platform, useColorScheme } from 'react-native';
import { NavigationContainer, DarkTheme, DefaultTheme } from '@react-navigation/native';
import { createBottomTabNavigator, BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme, Theme } from '../theme';
import { FinancingListScreen } from '../screens/FinancingListScreen';
import { DashboardScreen } from '../screens/DashboardScreen';
import { InstallmentListScreen } from '../screens/InstallmentListScreen';
import { InstallmentDetailScreen } from '../screens/InstallmentDetailScreen';
import { EditFinancingScreen } from '../screens/EditFinancingScreen';
import { ReportScreen } from '../screens/ReportScreen';
import { SimulationScreen } from '../screens/SimulationScreen';
import { ProfileScreen } from '../screens/ProfileScreen';
import { tabBarProgress, tabBarVisible } from './tabBarController';

export type RootStackParamList = {
  FinancingsTab: undefined;
  Dashboard: { financingId: string };
  Installments: { financingId: string };
  InstallmentDetail: { financingId: string; installmentId: string };
  EditFinancing: { financingId: string };
  Report: { financingId: string };
  Simulation: { financingId: string };
};

export type TabParamList = {
  Financings: undefined;
  Profile: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<TabParamList>();

const TAB_ICONS: Record<string, [React.ComponentProps<typeof Ionicons>['name'], React.ComponentProps<typeof Ionicons>['name']]> = {
  Financings: ['car-sport', 'car-sport-outline'],
  Profile:    ['person', 'person-outline'],
};

const TAB_LABELS: Record<string, string> = {
  Financings: 'Financiamentos',
  Profile:    'Perfil',
};

export const TAB_BAR_HEIGHT = 64;
export const TAB_BAR_MARGIN = 16;
export const TAB_BAR_BOTTOM_OFFSET = TAB_BAR_HEIGHT + TAB_BAR_MARGIN * 2;

const FloatingTabBar: React.FC<BottomTabBarProps> = ({ state, navigation }) => {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => makeTabStyles(theme), [theme]);
  const [tabVisible, setTabVisible] = useState(true);

  useEffect(() => {
    const id = tabBarVisible.addListener(({ value }) => setTabVisible(value > 0.05));
    return () => tabBarVisible.removeListener(id);
  }, []);

  const borderRadius = tabBarProgress.interpolate({ inputRange: [0, 1], outputRange: [28, 0] });
  const marginH = tabBarProgress.interpolate({ inputRange: [0, 1], outputRange: [TAB_BAR_MARGIN, 0] });
  const marginB = tabBarProgress.interpolate({ inputRange: [0, 1], outputRange: [TAB_BAR_MARGIN + insets.bottom, insets.bottom] });
  const shadowOpacity = tabBarProgress.interpolate({ inputRange: [0, 1], outputRange: [0.18, 0.04] });
  const shadowRadius = tabBarProgress.interpolate({ inputRange: [0, 1], outputRange: [24, 4] });

  return (
    <Animated.View style={[
      styles.bar,
      {
        borderRadius,
        marginHorizontal: marginH,
        marginBottom: marginB,
        shadowOpacity,
        shadowRadius,
        backgroundColor: theme.card,
        borderColor: theme.border,
        opacity: tabBarVisible,
      },
    ]} pointerEvents={tabVisible ? 'box-none' : 'none'}>
      {state.routes.map((route, index) => {
        const focused = state.index === index;
        const [activeIcon, inactiveIcon] = TAB_ICONS[route.name] ?? ['ellipse', 'ellipse-outline'];
        const label = TAB_LABELS[route.name] ?? route.name;
        const color = focused ? theme.accentDark : theme.textSecondary;

        return (
          <TouchableOpacity
            key={route.key}
            style={styles.tab}
            activeOpacity={0.7}
            onPress={() => {
              const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
              if (!focused && !event.defaultPrevented) navigation.navigate(route.name);
            }}
            onLongPress={() => navigation.emit({ type: 'tabLongPress', target: route.key })}
          >
            <Ionicons name={focused ? activeIcon : inactiveIcon} size={22} color={color} />
            <Text style={[styles.label, { color }]}>{label}</Text>
          </TouchableOpacity>
        );
      })}
    </Animated.View>
  );
};

const FinancingsStack = () => {
  const scheme = useColorScheme();
  const statusBarStyle = scheme === 'dark' ? 'light' : 'dark';
  return (
    <Stack.Navigator screenOptions={{ headerShown: false, statusBarStyle }}>
      <Stack.Screen name="FinancingsTab" component={FinancingListScreen} />
      <Stack.Screen name="Dashboard" component={DashboardScreen} />
      <Stack.Screen name="Installments" component={InstallmentListScreen} />
      <Stack.Screen name="InstallmentDetail" component={InstallmentDetailScreen} />
      <Stack.Screen name="EditFinancing" component={EditFinancingScreen} />
      <Stack.Screen name="Report" component={ReportScreen} />
      <Stack.Screen name="Simulation" component={SimulationScreen} />
    </Stack.Navigator>
  );
};

export const AppNavigator = () => {
  const scheme = useColorScheme();
  return (
    <NavigationContainer theme={scheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Tab.Navigator
        tabBar={(props) => <FloatingTabBar {...props} />}
        screenOptions={{ headerShown: false }}
      >
        <Tab.Screen name="Financings" component={FinancingsStack} />
        <Tab.Screen name="Profile" component={ProfileScreen} />
      </Tab.Navigator>
    </NavigationContainer>
  );
};

const makeTabStyles = (theme: Theme) => StyleSheet.create({
  bar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    height: TAB_BAR_HEIGHT,
    borderWidth: StyleSheet.hairlineWidth,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    elevation: 12,
    overflow: Platform.OS === 'android' ? 'hidden' : 'visible',
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  label: {
    fontSize: 10,
    fontWeight: '600',
  },
});
