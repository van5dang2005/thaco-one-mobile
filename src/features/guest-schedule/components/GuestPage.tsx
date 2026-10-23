import type { ReactNode } from 'react';
import { View } from 'react-native';

import { useTheme } from '@/core/theme/ThemeProvider';
import { useLightStatusBar } from '@/shared/ui/ScreenShell';

/** The guest screens' background: one even, cool grey, so the white cards and the header picture stand out on it. */
export const guestPageColors = { light: '#ECEFF3', dark: '#0B1420' };

/** Root of a guest screen: the even background, and a light status bar over the blue of the header picture. */
export function GuestPage({ children, testID }: { children: ReactNode; testID?: string }) {
  const { scheme } = useTheme();
  useLightStatusBar();
  return (
    <View testID={testID} className="flex-1" style={{ backgroundColor: guestPageColors[scheme] }}>
      {children}
    </View>
  );
}
