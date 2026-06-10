import { Animated } from 'react-native';

// 0 = floating (default), 1 = attached (scrolled to bottom)
export const tabBarProgress = new Animated.Value(0);
// 1 = visible, 0 = hidden
export const tabBarVisible = new Animated.Value(1);

export function attachTabBar() {
  Animated.timing(tabBarProgress, { toValue: 1, duration: 220, useNativeDriver: false }).start();
}

export function detachTabBar() {
  Animated.timing(tabBarProgress, { toValue: 0, duration: 220, useNativeDriver: false }).start();
}

export function hideTabBar() {
  Animated.timing(tabBarVisible, { toValue: 0, duration: 150, useNativeDriver: true }).start();
}

export function showTabBar() {
  Animated.timing(tabBarVisible, { toValue: 1, duration: 200, useNativeDriver: true }).start();
}
