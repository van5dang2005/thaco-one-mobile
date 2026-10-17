import { useFocusEffect } from 'expo-router';
import { setStatusBarStyle } from 'expo-status-bar';
import { type ReactNode, useCallback } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, RadialGradient, Rect, Stop } from 'react-native-svg';

import { useTheme } from '@/core/theme/ThemeProvider';

/**
 * The guest screens' background: a blue-grey wash from top to bottom, soft glows (brand blue top-left, teal on the
 * right, a faint blue low on the left) and faint concentric arcs in the top-right corner. White cards sit on it.
 */
const tones = {
  light: {
    wash: ['#C9DBF2', '#E7EDF5', '#E2EAF4'],
    glowA: { color: '#3F86E0', opacity: 0.5 },
    glowB: { color: '#2EC4D6', opacity: 0.32 },
    glowC: { color: '#5C7CFA', opacity: 0.16 },
    arc: '#00539B',
    arcOpacity: 0.09,
  },
  dark: {
    wash: ['#13233A', '#0B1420', '#0D1828'],
    glowA: { color: '#2A6DC4', opacity: 0.42 },
    glowB: { color: '#1A8FA0', opacity: 0.26 },
    glowC: { color: '#3D55B8', opacity: 0.18 },
    arc: '#FFFFFF',
    arcOpacity: 0.05,
  },
};

function Backdrop() {
  const c = tones[useTheme().scheme];
  const glows = [
    { id: 'glowA', cx: '6%', cy: '6%', r: 260, ...c.glowA },
    { id: 'glowB', cx: '96%', cy: '22%', r: 220, ...c.glowB },
    { id: 'glowC', cx: '0%', cy: '78%', r: 240, ...c.glowC },
  ];
  return (
    <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
      <Defs>
        <LinearGradient id="wash" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={c.wash[0]} />
          <Stop offset="0.35" stopColor={c.wash[1]} />
          <Stop offset="1" stopColor={c.wash[2]} />
        </LinearGradient>
        {glows.map((g) => (
          <RadialGradient key={g.id} id={g.id}>
            <Stop offset="0" stopColor={g.color} stopOpacity={g.opacity} />
            <Stop offset="1" stopColor={g.color} stopOpacity={0} />
          </RadialGradient>
        ))}
      </Defs>
      <Rect width="100%" height="100%" fill="url(#wash)" />
      {glows.map((g) => (
        <Circle key={g.id} cx={g.cx} cy={g.cy} r={g.r} fill={`url(#${g.id})`} />
      ))}
      {[70, 120, 170, 220].map((r) => (
        <Circle key={r} cx="100%" cy="0" r={r} fill="none" stroke={c.arc} strokeOpacity={c.arcOpacity} strokeWidth={1.5} />
      ))}
    </Svg>
  );
}

/**
 * Root of a guest screen: the backdrop fixed behind the whole page (content scrolls over it) and a status bar that
 * reads on it (dark text by day, light at night).
 */
export function GuestPage({ children, testID }: { children: ReactNode; testID?: string }) {
  const { scheme } = useTheme();
  useFocusEffect(
    useCallback(() => {
      setStatusBarStyle(scheme === 'dark' ? 'light' : 'dark');
    }, [scheme]),
  );
  return (
    <View testID={testID} className="flex-1" style={{ backgroundColor: tones[scheme].wash[1] }}>
      <Backdrop />
      {children}
    </View>
  );
}
