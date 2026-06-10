import { useWindowDimensions } from 'react-native';

export type Breakpoint = 'sm' | 'md' | 'lg';

export function useResponsive() {
  const { width } = useWindowDimensions();
  const isDesktop = width >= 900;
  const isTablet = width >= 600 && width < 900;
  const isMobile = width < 600;

  const maxContentWidth = isDesktop ? 720 : undefined;
  const contentStyle = isDesktop
    ? { maxWidth: 720, width: '100%' as const, alignSelf: 'center' as const }
    : undefined;

  return { width, isDesktop, isTablet, isMobile, maxContentWidth, contentStyle };
}
