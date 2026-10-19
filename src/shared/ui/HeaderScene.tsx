import type { ReactNode } from 'react';
import { StyleSheet } from 'react-native';
import Svg, { Defs, LinearGradient, Path, RadialGradient, Rect, Stop } from 'react-native-svg';

import { useTheme } from '@/core/theme/ThemeProvider';

/**
 * A module header's picture is 400 × 238, bottom-aligned (`xMidYMax slice`) like the room calendar's: on a 402pt
 * phone the toolbar sits at y ≈ 76–118, the date at ≈ 124–138 and the big count at ≈ 144–200 on the left (to x ≈ 180),
 * so a scene keeps its subject on the right, x ≥ 200, under the toolbar. Under the ground the hazy skyline runs on
 * and fades into the canvas by the bottom edge, behind the cards that overlap the header (`ModuleScreen` `overlap`),
 * so the picture has no line or edge at its foot, beside the cards or when they are pulled down.
 */
export const SCENE = { width: 400, height: 238, ground: 214 } as const;

// ---- path helpers: a few <Path>s instead of many <Rect>s --------------------------------------

const r2 = (v: number) => Math.round(v * 100) / 100;
/** A rectangle drawn clockwise, like every shape here: overlapping shapes of one path then fill once. */
export const box = (x: number, y: number, w: number, h: number) => `M${r2(x)} ${r2(y)}h${r2(w)}v${r2(h)}h${r2(-w)}Z`;
export const disc = (cx: number, cy: number, r: number) =>
  `M${r2(cx - r)} ${r2(cy)}a${r2(r)} ${r2(r)} 0 1 1 ${r2(2 * r)} 0a${r2(r)} ${r2(r)} 0 1 1 ${r2(-2 * r)} 0Z`;
const pill = (x: number, y: number, w: number, h: number) => {
  const r = h / 2;
  return `M${r2(x + r)} ${r2(y)}h${r2(w - h)}a${r2(r)} ${r2(r)} 0 0 1 0 ${r2(h)}h${r2(h - w)}a${r2(r)} ${r2(r)} 0 0 1 0 ${r2(-h)}Z`;
};
/** Steps from `from` while below `to`. */
export const steps = (from: number, to: number, step: number) => Array.from({ length: Math.max(0, Math.ceil((to - from) / step)) }, (_, i) => from + i * step);
/** The same scatter on every render: which windows are lit. */
export const hash = (a: number, b: number, seed: number) => ((a * 73856093) ^ (b * 19349663) ^ (seed * 83492791)) >>> 0;

/** The room calendar's sky (`CalendarHeaderArt`), so the module headers read as one family. */
const palettes = {
  light: {
    sky: ['#003F86', '#0A57A8', '#1767BA'],
    glow: '#CFE6FF',
    glowOpacity: 0.42,
    far: '#2670BF',
    haze: '#8CC4F5',
    hazeOpacity: 0.16,
    scrim: '#00306A',
    scrimOpacity: 0.5,
  },
  dark: {
    sky: ['#050B16', '#091729', '#10274A'],
    glow: '#7FAEE0',
    glowOpacity: 0.16,
    far: '#11233F',
    haze: '#2E6FC0',
    hazeOpacity: 0.18,
    scrim: '#03070F',
    scrimOpacity: 0.55,
  },
};

/**
 * The far skyline in the haze along the ground, kept low so the big count on the left sits on sky, `[x, width, height]`
 * above the ground. The blocks touch, and run on to the bottom edge, so the ground is a fade rather than a line.
 */
const FAR: [number, number, number][] = [
  [-2, 16, 20], [12, 12, 30], [22, 18, 16], [38, 14, 26], [50, 20, 18], [68, 12, 34], [78, 16, 22], [92, 18, 28], [108, 14, 18],
  [120, 20, 32], [138, 12, 22], [148, 18, 38], [164, 14, 24], [176, 20, 44], [194, 12, 30], [204, 18, 52], [220, 14, 40],
  [232, 20, 58], [250, 12, 46], [260, 18, 62], [276, 14, 50], [288, 20, 66], [306, 12, 54], [316, 18, 70], [332, 14, 58],
  [344, 20, 74], [362, 12, 60], [372, 16, 68], [386, 16, 56],
];
const FAR_PATH = FAR.map(([x, w, h]) => box(x, SCENE.ground - h, w, h + SCENE.height - SCENE.ground)).join('');
/** Its windows lit at night: a few, and only right of the count's words. */
const FAR_LIT = FAR.filter(([x]) => x >= 196)
  .flatMap(([x, w, h]) => steps(SCENE.ground - h + 5, SCENE.ground - 3, 6).flatMap((y) => steps(x + 3, x + w - 4, 5).map((wx) => [wx, y] as const)))
  .filter(([x, y]) => hash(x, y, 7) % 6 === 0)
  .map(([x, y]) => box(x, y, 2.4, 2))
  .join('');
/** Day light rays fanning from the top-right corner. */
const RAYS = 'M412 10L130 150L166 170ZM412 10L60 120L84 138ZM412 10L240 200L272 206Z';

type Props = {
  /** Prefix of the gradient ids. */
  id: string;
  /** Day clouds, `[x, y, scale, opacity]`. */
  clouds: [number, number, number, number][];
  /** Night stars, `[x, y, radius]`, in three brightnesses (brightest first). */
  stars: [number, number, number][][];
  /** The scene's subject, standing on the ground over the far skyline; `night` follows the theme. */
  children: (night: boolean) => ReactNode;
};

/**
 * Backdrop of a module header's picture (Văn thư, Bưu phẩm): the room calendar's sky with its glow, rays and clouds
 * by day or stars by night, and a low hazy skyline that fades into the canvas under the ground, behind the cards. The
 * scene's subject goes in `children`; a scrim at the top keeps the status bar readable.
 */
export function HeaderScene({ id, clouds, stars, children }: Props) {
  const { scheme, colors } = useTheme();
  const c = palettes[scheme];
  const night = scheme === 'dark';
  const { width: W, height: H, ground: G } = SCENE;
  return (
    // Sized by absoluteFill alone: percentage sizes on an absolute child resolve against the header's padded content box.
    <Svg pointerEvents="none" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMax slice" style={StyleSheet.absoluteFill}>
      <Defs>
        <LinearGradient id={`${id}Sky`} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={c.sky[0]} />
          <Stop offset="0.55" stopColor={c.sky[1]} />
          <Stop offset="1" stopColor={c.sky[2]} />
        </LinearGradient>
        <RadialGradient id={`${id}Glow`} cx="372" cy="50" r="230" gradientUnits="userSpaceOnUse">
          <Stop offset="0" stopColor={c.glow} stopOpacity={c.glowOpacity} />
          <Stop offset="1" stopColor={c.glow} stopOpacity={0} />
        </RadialGradient>
        {/* Haze thickening down to the ground, then even under it. */}
        <LinearGradient id={`${id}Haze`} x1="0" y1={G - 80} x2="0" y2={H} gradientUnits="userSpaceOnUse">
          <Stop offset="0" stopColor={c.haze} stopOpacity={0} />
          <Stop offset={80 / (H - G + 80)} stopColor={c.haze} stopOpacity={c.hazeOpacity} />
          <Stop offset="1" stopColor={c.haze} stopOpacity={c.hazeOpacity} />
        </LinearGradient>
        {/* From the ground the picture eases into the canvas, reaching it at the bottom edge. */}
        <LinearGradient id={`${id}Fade`} x1="0" y1={G} x2="0" y2={H} gradientUnits="userSpaceOnUse">
          <Stop offset="0" stopColor={colors.canvas} stopOpacity={0} />
          <Stop offset="1" stopColor={colors.canvas} />
        </LinearGradient>
        <LinearGradient id={`${id}Scrim`} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={c.scrim} stopOpacity={c.scrimOpacity} />
          <Stop offset="0.45" stopColor={c.scrim} stopOpacity={0} />
        </LinearGradient>
      </Defs>
      <Rect width={W} height={H} fill={`url(#${id}Sky)`} />
      <Rect width={W} height={H} fill={`url(#${id}Glow)`} />
      {night ? (
        stars.map((points, i) => <Path key={i} d={points.map(([x, y, r]) => disc(x, y, r)).join('')} fill="#FFFFFF" fillOpacity={[0.8, 0.55, 0.4][i] ?? 0.4} />)
      ) : (
        <>
          <Path d={RAYS} fill="#FFFFFF" fillOpacity={0.045} />
          {clouds.map(([x, y, s, opacity], i) => (
            <Path
              key={i}
              d={pill(x - 24 * s, y, 48 * s, 8 * s) + disc(x - 10 * s, y + s, 7.5 * s) + disc(x + 3 * s, y - 2 * s, 10 * s) + disc(x + 15 * s, y + 2 * s, 6.5 * s)}
              fill="#FFFFFF"
              fillOpacity={opacity}
            />
          ))}
        </>
      )}

      <Path d={FAR_PATH} fill={c.far} />
      {night ? <Path d={FAR_LIT} fill="#FFD27A" fillOpacity={0.5} /> : null}
      <Rect y={G - 80} width={W} height={H - G + 80} fill={`url(#${id}Haze)`} />

      {children(night)}

      <Rect y={G} width={W} height={H - G} fill={`url(#${id}Fade)`} />

      <Rect width={W} height={H} fill={`url(#${id}Scrim)`} />
    </Svg>
  );
}
