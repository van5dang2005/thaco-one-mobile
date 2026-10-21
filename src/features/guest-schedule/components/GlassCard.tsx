import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import { type ReactNode, useId, useState } from 'react';
import { StyleSheet, View, type ViewProps } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import { useTheme } from '@/core/theme/ThemeProvider';

/** Corner radius of the glass drops. */
const RADIUS = 22;
/** Width of the lit rim. */
const RIM = 1.5;

/**
 * Glass where the system has none, as close to Liquid Glass as a picture-free card gets: a thick frosted fill (no blur
 * here, so it hides the busy picture more than iOS lets through), a rim lit at the top left and the bottom right, a
 * sheen over the top and a glow along the bottom edge.
 */
const fallback = {
  light: {
    fill: { color: '#FFFFFF', top: 0.88, bottom: 0.74 },
    rim: { color: '#FFFFFF', lit: 1, dim: 0.3 },
    sheen: 0.75,
    glow: 0.45,
    shadow: '0px 10px 28px rgba(15, 27, 45, 0.22)',
  },
  dark: {
    fill: { color: '#1A2B44', top: 0.88, bottom: 0.78 },
    rim: { color: '#FFFFFF', lit: 0.42, dim: 0.06 },
    sheen: 0.16,
    glow: 0.1,
    shadow: '0px 10px 28px rgba(0, 0, 0, 0.45)',
  },
};

/** Layout goes in `style`: the native glass view takes no `className`. */
type Props = ViewProps & { children?: ReactNode };

/**
 * A card of glass over a picture, like a water drop: Liquid Glass on iOS 26+, and elsewhere a frosted card with a lit
 * rim, a sheen on top and a glow at the bottom, so it reads as the same glass.
 */
export function GlassCard({ style, children, onLayout, ...rest }: Props) {
  const { scheme } = useTheme();
  const id = useId().replace(/[^a-zA-Z\d]/g, '');
  const [size, setSize] = useState({ width: 0, height: 0 });
  if (isLiquidGlassAvailable()) {
    return (
      <GlassView {...rest} onLayout={onLayout} glassEffectStyle="regular" colorScheme={scheme} style={[{ borderRadius: RADIUS }, style]}>
        {children}
      </GlassView>
    );
  }
  const c = fallback[scheme];
  return (
    <View
      {...rest}
      onLayout={(e) => {
        setSize({ width: e.nativeEvent.layout.width, height: e.nativeEvent.layout.height });
        onLayout?.(e);
      }}
      style={[{ overflow: 'hidden', borderRadius: RADIUS, boxShadow: c.shadow }, style]}
    >
      <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
        <Defs>
          <LinearGradient id={`${id}fill`} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={c.fill.color} stopOpacity={c.fill.top} />
            <Stop offset="1" stopColor={c.fill.color} stopOpacity={c.fill.bottom} />
          </LinearGradient>
          <LinearGradient id={`${id}sheen`} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#FFFFFF" stopOpacity={c.sheen} />
            <Stop offset="0.45" stopColor="#FFFFFF" stopOpacity={0} />
            <Stop offset="0.75" stopColor="#FFFFFF" stopOpacity={0} />
            <Stop offset="1" stopColor="#FFFFFF" stopOpacity={c.glow} />
          </LinearGradient>
          <LinearGradient id={`${id}rim`} x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={c.rim.color} stopOpacity={c.rim.lit} />
            <Stop offset="0.5" stopColor={c.rim.color} stopOpacity={c.rim.dim} />
            <Stop offset="1" stopColor={c.rim.color} stopOpacity={c.rim.lit * 0.7} />
          </LinearGradient>
        </Defs>
        <Rect width="100%" height="100%" fill={`url(#${id}fill)`} />
        <Rect width="100%" height="100%" fill={`url(#${id}sheen)`} />
        {size.width ? (
          <Rect
            x={RIM / 2}
            y={RIM / 2}
            width={size.width - RIM}
            height={size.height - RIM}
            rx={RADIUS - RIM / 2}
            fill="none"
            stroke={`url(#${id}rim)`}
            strokeWidth={RIM}
          />
        ) : null}
      </Svg>
      {children}
    </View>
  );
}
