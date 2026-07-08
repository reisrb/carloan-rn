import React, { useEffect, useMemo, useState } from 'react';
import { View, TouchableOpacity, Text, StyleSheet, Animated, Platform, useColorScheme } from 'react-native';
import { NavigationContainer, DarkTheme, DefaultTheme, useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { createBottomTabNavigator, BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator, NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme, Theme } from '../theme';
import { CarProvider, useCar } from '../contexts/CarContext';
import { CarsListScreen } from '../screens/CarsListScreen';
import { ProfileScreen } from '../screens/ProfileScreen';
import { CarInfoScreen } from '../screens/CarInfoScreen';
import { ExpensesScreen } from '../screens/ExpensesScreen';
import { FinancingScreen } from '../screens/FinancingScreen';
import { MaintenanceScreen } from '../screens/MaintenanceScreen';
import { AccessoriesScreen } from '../screens/AccessoriesScreen';
import { InstallmentListScreen } from '../screens/InstallmentListScreen';
import { InstallmentDetailScreen } from '../screens/InstallmentDetailScreen';
import { EditCarScreen } from '../screens/EditCarScreen';
import { MonthlyExpensesScreen } from '../screens/MonthlyExpensesScreen';
import { ReportScreen } from '../screens/ReportScreen';
import { SimulationScreen } from '../screens/SimulationScreen';
import { tabBarProgress, tabBarVisible } from './tabBarController';

export type RootStackParamList = {
  Home: undefined;
  CarHub: { financingId: string; readOnly?: boolean; ownerUsername?: string };
  Installments: { financingId: string; readOnly?: boolean };
  InstallmentDetail: { financingId: string; installmentId: string; readOnly?: boolean };
  EditCar: { financingId: string };
  MonthlyExpenses: { financingId: string; readOnly?: boolean };
  Report: { financingId: string };
  Simulation: { financingId: string };
};

export type HomeTabParamList = {
  Carros: undefined;
  Perfil: undefined;
};

export type CarHubTabParamList = {
  Infos: undefined;
  Total: undefined;
  Financiamento: undefined;
  Manutencao: undefined;
  Acessorios: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();
const HomeTab = createBottomTabNavigator<HomeTabParamList>();
const HubTab = createBottomTabNavigator<CarHubTabParamList>();

type IconPair = [React.ComponentProps<typeof Ionicons>['name'], React.ComponentProps<typeof Ionicons>['name']];

const TAB_ICONS: Record<string, IconPair> = {
  Carros:        ['car-sport', 'car-sport-outline'],
  Perfil:        ['person', 'person-outline'],
  Infos:         ['information-circle', 'information-circle-outline'],
  Total:         ['cash', 'cash-outline'],
  Financiamento: ['card', 'card-outline'],
  Manutencao:    ['construct', 'construct-outline'],
  Acessorios:    ['pricetags', 'pricetags-outline'],
};

const TAB_LABELS: Record<string, string> = {
  Carros:        'Carros',
  Perfil:        'Perfil',
  Infos:         'Infos',
  Total:         'Total',
  Financiamento: 'Financ.',
  Manutencao:    'Manut.',
  Acessorios:    'Acessórios',
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
          >
            <Ionicons name={focused ? activeIcon : inactiveIcon} size={22} color={color} />
            <Text style={[styles.label, { color }]}>{label}</Text>
          </TouchableOpacity>
        );
      })}
    </Animated.View>
  );
};

const HomeTabs = () => (
  <HomeTab.Navigator tabBar={(props) => <FloatingTabBar {...props} />} screenOptions={{ headerShown: false }}>
    <HomeTab.Screen name="Carros" component={CarsListScreen} />
    <HomeTab.Screen name="Perfil" component={ProfileScreen} />
  </HomeTab.Navigator>
);

const CarHubHeader: React.FC = () => {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { car } = useCar();
  const styles = useMemo(() => makeHeaderStyles(theme), [theme]);
  return (
    <View style={[styles.bar, { paddingTop: insets.top + 4 }]}>
      <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
        <Ionicons name="chevron-back" size={28} color={theme.accentDark} />
      </TouchableOpacity>
      <Text style={styles.title} numberOfLines={1}>{car?.carName ?? 'Carro'}</Text>
      <View style={{ width: 36 }} />
    </View>
  );
};

const CarHubTabs = () => (
  <HubTab.Navigator tabBar={(props) => <FloatingTabBar {...props} />} screenOptions={{ headerShown: false }}>
    <HubTab.Screen name="Infos" component={CarInfoScreen} />
    <HubTab.Screen name="Total" component={ExpensesScreen} />
    <HubTab.Screen name="Financiamento" component={FinancingScreen} />
    <HubTab.Screen name="Manutencao" component={MaintenanceScreen} />
    <HubTab.Screen name="Acessorios" component={AccessoriesScreen} />
  </HubTab.Navigator>
);

const CarHubScreen: React.FC = () => {
  const theme = useTheme();
  const route = useRoute<RouteProp<RootStackParamList, 'CarHub'>>();
  const { financingId, readOnly, ownerUsername } = route.params;
  return (
    <CarProvider financingId={financingId} readOnly={readOnly} ownerUsername={ownerUsername}>
      <View style={{ flex: 1, backgroundColor: theme.bg }}>
        <CarHubHeader />
        <CarHubTabs />
      </View>
    </CarProvider>
  );
};

export const AppNavigator = () => {
  const scheme = useColorScheme();
  const statusBarStyle = scheme === 'dark' ? 'light' : 'dark';
  return (
    <NavigationContainer theme={scheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack.Navigator screenOptions={{ headerShown: false, statusBarStyle }}>
        <Stack.Screen name="Home" component={HomeTabs} />
        <Stack.Screen name="CarHub" component={CarHubScreen} />
        <Stack.Screen name="Installments" component={InstallmentListScreen} />
        <Stack.Screen name="InstallmentDetail" component={InstallmentDetailScreen} />
        <Stack.Screen name="EditCar" component={EditCarScreen} />
        <Stack.Screen name="MonthlyExpenses" component={MonthlyExpensesScreen} />
        <Stack.Screen name="Report" component={ReportScreen} />
        <Stack.Screen name="Simulation" component={SimulationScreen} />
      </Stack.Navigator>
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
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 3 },
  label: { fontSize: 10, fontWeight: '600' },
});

const makeHeaderStyles = (theme: Theme) => StyleSheet.create({
  bar: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingBottom: 10,
    backgroundColor: theme.bg, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: theme.border,
  },
  backBtn: { padding: 4 },
  title: { flex: 1, fontSize: 20, fontWeight: '800', color: theme.text, textAlign: 'center' },
});
