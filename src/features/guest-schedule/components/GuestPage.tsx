import { useFocusEffect } from 'expo-router';
import { setStatusBarStyle } from 'expo-status-bar';
import { type ReactNode, useCallback } from 'react';
import { View } from 'react-native';

import { useTheme } from '@/core/theme/ThemeProvider';

/** The guest screens' background: one even, cool grey, so the white cards and the header picture stand out on it. */
export const guestPageColors = { light: '#ECEFF3', dark: '#0B1420' };

/** Root of a guest screen: the even background and a status bar that reads on it (dark text by day, light at night). */
export function GuestPage({ children, testID }: { children: ReactNode; testID?: string }) {
  const { scheme } = useTheme();
  useFocusEffect(
    useCallback(() => {
      setStatusBarStyle(scheme === 'dark' ? 'light' : 'dark');
    }, [scheme]),
  );
  return (
    <View testID={testID} className="flex-1" style={{ backgroundColor: guestPageColors[scheme] }}>
      {children}
    </View>
  );
}
