import { memo } from 'react';
import { Circle, Defs, Ellipse, G, LinearGradient, Path, RadialGradient, Rect, Stop } from 'react-native-svg';

import { useTheme } from '@/core/theme/ThemeProvider';
import { HeaderScene } from '@/shared/ui/HeaderScene';

/** Day and night colours: a navy phone with a lit blue screen, and two app-style tiles (fixes green, new features gold). */
const palettes = {
  light: {
    bezel: ['#33435F', '#0F1B2E'],
    bezelEdge: '#7186A6',
    screen: ['#47A2FF', '#0B56BA'],
    screenGlow: '#D6ECFF',
    island: '#0A1220',
    shadow: '#001E4A',
    shadowOpacity: 0.32,
    chevrons: '#FFFFFF',
    tiles: { fixed: ['#45D394', '#12875A'], fresh: ['#FFD766', '#E5940F'] },
    tileShadow: '#00214F',
    tileShadowOpacity: 0.22,
    sparkle: '#FFFFFF',
    sparkleOpacity: 0.85,
  },
  dark: {
    bezel: ['#2A3A57', '#080F1C'],
    bezelEdge: '#4A6189',
    screen: ['#2F80DF', '#0A3E8A'],
    screenGlow: '#9CCBFF',
    island: '#03070F',
    shadow: '#000000',
    shadowOpacity: 0.45,
    chevrons: '#CFE6FF',
    tiles: { fixed: ['#2FA472', '#11603F'], fresh: ['#D9A83F', '#8A5A12'] },
    tileShadow: '#000000',
    tileShadowOpacity: 0.4,
    sparkle: '#FFE7A8',
    sparkleOpacity: 0.7,
  },
};

// ---- geometry (scene units, see `HeaderScene`) ---------------------------------------------------
// The popup's header shows the whole width (x 0–400) and crops the top ≈ 20 units: the subject stays centred,
// x ≈ 108–276, its top at y ≈ 48.

/** The phone, 62 × 120 local units, leaning back a little about its centre. */
const PHONE = { x: 169, y: 84, tilt: -7 };
const W = 62;
const H = 120;
/** Progress ring round the arrow on the screen: 72% done. */
const RING = { cx: 31, cy: 50, r: 14 };
const RING_LENGTH = 2 * Math.PI * RING.r;

/** Floating tiles on a 24-unit grid. */
type Tile = { x: number; y: number; size: number; tilt: number };
const TILES: Record<'fixed' | 'fresh', Tile> = {
  fixed: { x: 116, y: 128, size: 27, tilt: -12 },
  fresh: { x: 250, y: 100, size: 24, tilt: 10 },
};
const TILE_BODY = 'M6.5 0H17.5A6.5 6.5 0 0 1 24 6.5V17.5A6.5 6.5 0 0 1 17.5 24H6.5A6.5 6.5 0 0 1 0 17.5V6.5A6.5 6.5 0 0 1 6.5 0Z';

/** A four-point twinkle. */
const sparkle = (x: number, y: number, r: number) =>
  `M${x} ${y - r}Q${x + r * 0.18} ${y - r * 0.18} ${x + r} ${y}Q${x + r * 0.18} ${y + r * 0.18} ${x} ${y + r}Q${x - r * 0.18} ${y + r * 0.18} ${x - r} ${y}Q${x - r * 0.18} ${y - r * 0.18} ${x} ${y - r}Z`;
const GLYPHS = {
  fixed: 'M7 12.6L10.6 16.2L17.2 9.2',
  fresh: sparkle(12, 12, 6.6),
};
const SPARKLES = sparkle(262, 168, 4.5) + sparkle(146, 96, 3.2) + sparkle(236, 70, 2.6) + sparkle(108, 186, 2.4);

/** Rising chevrons above the phone, in its own units, brightest nearest. */
const CHEVRONS: [number, number][] = [
  [-10, 0.8],
  [-21, 0.5],
  [-32, 0.26],
];

const CLOUDS: [number, number, number, number][] = [[112, 62, 0.6, 0.12], [300, 128, 0.5, 0.1], [262, 46, 0.4, 0.08]];
const STARS: [number, number, number][][] = [
  [[128, 60, 1.1], [286, 82, 0.9], [96, 150, 0.9], [306, 170, 0.8]],
  [[240, 52, 0.8], [160, 46, 0.7], [312, 120, 0.7], [84, 104, 0.7]],
  [[200, 40, 0.6], [270, 140, 0.6], [134, 172, 0.6], [330, 60, 0.6]],
];

function FloatingTile({ kind, tile, colors }: { kind: keyof typeof TILES; tile: Tile; colors: (typeof palettes)['light'] }) {
  const s = tile.size / 24;
  return (
    <G transform={`translate(${tile.x} ${tile.y}) rotate(${tile.tilt} ${tile.size / 2} ${tile.size / 2}) scale(${s})`}>
      <Path d={TILE_BODY} transform="translate(0.6 2.6) scale(1.02)" fill={colors.tileShadow} fillOpacity={colors.tileShadowOpacity * 0.5} />
      <Path d={TILE_BODY} transform="translate(0.3 1.3)" fill={colors.tileShadow} fillOpacity={colors.tileShadowOpacity} />
      <Path d={TILE_BODY} fill={`url(#suTile_${kind})`} />
      <Path d={TILE_BODY} fill="url(#suTileGloss)" />
      {kind === 'fixed' ? (
        <Path d={GLYPHS.fixed} stroke="#FFFFFF" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" fill="none" />
      ) : (
        <Path d={GLYPHS.fresh} fill="#FFFFFF" />
      )}
    </G>
  );
}

/**
 * Header picture of the store-update popup over the shared sky and skyline (`HeaderScene`), easing into the popup's
 * surface: a phone floating over its shadow, its screen downloading (progress ring round an up arrow), chevrons rising
 * above it, and two tiles for what the new version brings (fixes, new features).
 */
export const StoreUpdateArt = memo(function StoreUpdateArt() {
  const { colors } = useTheme();
  return (
    <HeaderScene id="su" clouds={CLOUDS} stars={STARS} fadeTo={colors.surface}>
      {(night) => {
        const c = palettes[night ? 'dark' : 'light'];
        return (
          <>
            <Defs>
              <LinearGradient id="suBezel" x1="0" y1="0" x2="1" y2="1">
                <Stop offset="0" stopColor={c.bezel[0]} />
                <Stop offset="1" stopColor={c.bezel[1]} />
              </LinearGradient>
              <LinearGradient id="suScreen" x1="0" y1="0" x2="0.4" y2="1">
                <Stop offset="0" stopColor={c.screen[0]} />
                <Stop offset="1" stopColor={c.screen[1]} />
              </LinearGradient>
              <RadialGradient id="suScreenGlow" cx="0.3" cy="0.22" r="0.6">
                <Stop offset="0" stopColor={c.screenGlow} stopOpacity={0.55} />
                <Stop offset="1" stopColor={c.screenGlow} stopOpacity={0} />
              </RadialGradient>
              <RadialGradient id="suShadow" cx="0.5" cy="0.5" r="0.5">
                <Stop offset="0" stopColor={c.shadow} stopOpacity={c.shadowOpacity} />
                <Stop offset="1" stopColor={c.shadow} stopOpacity={0} />
              </RadialGradient>
              {(Object.keys(TILES) as (keyof typeof TILES)[]).map((kind) => (
                <LinearGradient key={kind} id={`suTile_${kind}`} x1="0" y1="0" x2="0.35" y2="1">
                  <Stop offset="0" stopColor={c.tiles[kind][0]} />
                  <Stop offset="1" stopColor={c.tiles[kind][1]} />
                </LinearGradient>
              ))}
              <LinearGradient id="suTileGloss" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor="#FFFFFF" stopOpacity={0.32} />
                <Stop offset="0.5" stopColor="#FFFFFF" stopOpacity={0.04} />
                <Stop offset="1" stopColor="#FFFFFF" stopOpacity={0} />
              </LinearGradient>
            </Defs>

            {/* Shadow on the haze under the floating phone. */}
            <Ellipse cx={196} cy={210} rx={42} ry={5} fill="url(#suShadow)" />

            {(Object.keys(TILES) as (keyof typeof TILES)[]).map((kind) => (
              <FloatingTile key={kind} kind={kind} tile={TILES[kind]} colors={c} />
            ))}
            <Path d={SPARKLES} fill={c.sparkle} fillOpacity={c.sparkleOpacity} />

            <G transform={`translate(${PHONE.x} ${PHONE.y}) rotate(${PHONE.tilt} ${W / 2} ${H / 2})`}>
              {CHEVRONS.map(([y, opacity]) => (
                <Path
                  key={y}
                  d={`M${W / 2 - 9} ${y + 5}L${W / 2} ${y - 3.5}L${W / 2 + 9} ${y + 5}`}
                  stroke={c.chevrons}
                  strokeOpacity={opacity}
                  strokeWidth={3.2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  fill="none"
                />
              ))}

              {/* Body with a drop shadow, side buttons and a lit rim. */}
              <Rect x={1.5} y={4} width={W} height={H} rx={12} fill={c.shadow} fillOpacity={c.shadowOpacity * 0.6} />
              <Rect x={-1.6} y={26} width={2.4} height={10} rx={1.2} fill={c.bezel[1]} />
              <Rect x={-1.6} y={40} width={2.4} height={16} rx={1.2} fill={c.bezel[1]} />
              <Rect x={W - 0.8} y={34} width={2.4} height={20} rx={1.2} fill={c.bezel[1]} />
              <Rect width={W} height={H} rx={12} fill="url(#suBezel)" />
              <Rect x={0.6} y={0.6} width={W - 1.2} height={H - 1.2} rx={11.4} stroke={c.bezelEdge} strokeOpacity={0.7} strokeWidth={1.2} fill="none" />

              {/* Screen: glow, a diagonal sheen, the island. */}
              <Rect x={3.5} y={3.5} width={W - 7} height={H - 7} rx={9} fill="url(#suScreen)" />
              <Rect x={3.5} y={3.5} width={W - 7} height={H - 7} rx={9} fill="url(#suScreenGlow)" />
              <Path d="M3.5 44L58.5 14V32L3.5 62Z" fill="#FFFFFF" fillOpacity={0.07} />
              <Rect x={23} y={8} width={16} height={4.6} rx={2.3} fill={c.island} />

              {/* Download in progress: ring round an up arrow, a bar, two lines of text, the home indicator. */}
              <Circle cx={RING.cx} cy={RING.cy} r={RING.r} stroke="#FFFFFF" strokeOpacity={0.25} strokeWidth={3} fill="none" />
              <Circle
                cx={RING.cx}
                cy={RING.cy}
                r={RING.r}
                stroke="#FFFFFF"
                strokeWidth={3}
                strokeLinecap="round"
                strokeDasharray={`${RING_LENGTH * 0.72} ${RING_LENGTH}`}
                transform={`rotate(-90 ${RING.cx} ${RING.cy})`}
                fill="none"
              />
              <Path d={`M${RING.cx} ${RING.cy + 6.5}V${RING.cy - 6.5}M${RING.cx - 5.5} ${RING.cy - 1}L${RING.cx} ${RING.cy - 6.5}L${RING.cx + 5.5} ${RING.cy - 1}`} stroke="#FFFFFF" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" fill="none" />
              <Rect x={13} y={76} width={36} height={4} rx={2} fill="#FFFFFF" fillOpacity={0.25} />
              <Rect x={13} y={76} width={26} height={4} rx={2} fill="#FFFFFF" />
              <Rect x={17} y={87} width={28} height={3} rx={1.5} fill="#FFFFFF" fillOpacity={0.35} />
              <Rect x={21} y={94} width={20} height={3} rx={1.5} fill="#FFFFFF" fillOpacity={0.25} />
              <Rect x={22} y={109} width={18} height={2.4} rx={1.2} fill="#FFFFFF" fillOpacity={0.55} />
            </G>
          </>
        );
      }}
    </HeaderScene>
  );
});
