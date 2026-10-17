import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import type { ReactNode } from 'react';
import { StyleSheet, View, type ViewProps } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import { useTheme } from '@/core/theme/ThemeProvider';

/** Corner radius of the glass drops. */
const RADIUS = 22;

/** Glass where the system has none: a see-through fill, a bright rim and a sheen over the top half. */
const fallback = {
  light: { fill: 'rgba(255, 255, 255, 0.68)', rim: 'rgba(255, 255, 255, 0.85)', sheen: 0.55 },
  dark: { fill: 'rgba(22, 36, 56, 0.68)', rim: 'rgba(255, 255, 255, 0.14)', sheen: 0.1 },
};

/** Layout goes in `style`: the native glass view takes no `className`. */
type Props = ViewProps & { children?: ReactNode };

/**
 * A card of glass over a picture, like a water drop: Liquid Glass on iOS 26+, and elsewhere a translucent card with a
 * light rim and a sheen on top, so the picture shows through either way.
 */
export function GlassCard({ style, children, ...rest }: Props) {
  const { scheme } = useTheme();
  if (isLiquidGlassAvailable()) {
    return (
      <GlassView {...rest} glassEffectStyle="regular" colorScheme={scheme} style={[{ borderRadius: RADIUS }, style]}>
        {children}
      </GlassView>
    );
  }
  const c = fallback[scheme];
  return (
    <View
      {...rest}
      style={[{ overflow: 'hidden', borderRadius: RADIUS, backgroundColor: c.fill, borderWidth: 1, borderColor: c.rim, boxShadow: '0px 8px 24px rgba(15, 27, 45, 0.12)' }, style]}
    >
      <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
        <Defs>
          <LinearGradient id="glassSheen" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#FFFFFF" stopOpacity={c.sheen} />
            <Stop offset="0.5" stopColor="#FFFFFF" stopOpacity={0} />
          </LinearGradient>
        </Defs>
        <Rect width="100%" height="100%" fill="url(#glassSheen)" />
      </Svg>
      {children}
    </View>
  );
}
