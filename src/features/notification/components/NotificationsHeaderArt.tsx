import { memo } from 'react';
import { Circle, Defs, Ellipse, G, LinearGradient, Path, RadialGradient, Rect, Stop } from 'react-native-svg';

import { HeaderScene } from '@/shared/ui/HeaderScene';

/**
 * Day and night colours. The bell is polished brass lit from the top left; the three app icons are the modules whose
 * notifications land here, in their Home colours (meeting blue, parcel green, document violet).
 */
const palettes = {
  light: {
    bell: ['#FFE9A3', '#FFC93F', '#F0A11A', '#C9780A'],
    bellGlow: '#FFF6D6',
    lip: ['#FFD766', '#D98A0E'],
    lipEdge: '#FFF1BF',
    clapper: ['#F7B637', '#A9630A'],
    shine: '#FFFFFF',
    shineOpacity: 0.6,
    shadow: '#001E4A',
    shadowOpacity: 0.3,
    waves: '#FFFFFF',
    wavesOpacity: 0.6,
    tiles: {
      meeting: ['#5AAEFF', '#1F62D6'],
      parcel: ['#45D394', '#12875A'],
      document: ['#B096FF', '#6A43D1'],
    },
    tileShadow: '#00214F',
    tileShadowOpacity: 0.22,
    glyph: '#FFFFFF',
    badge: '#EF4B3F',
    done: '#1FA971',
    badgeRing: '#FFFFFF',
    sparkle: '#FFFFFF',
    sparkleOpacity: 0.85,
  },
  dark: {
    bell: ['#F3D58A', '#D9A83F', '#B97E1F', '#8A5A12'],
    bellGlow: '#FFE7A8',
    lip: ['#DDB04F', '#9E6812'],
    lipEdge: '#F6DE9C',
    clapper: ['#C9922D', '#7A4A0C'],
    shine: '#FFF4D6',
    shineOpacity: 0.4,
    shadow: '#000000',
    shadowOpacity: 0.45,
    waves: '#CFE6FF',
    wavesOpacity: 0.4,
    tiles: {
      meeting: ['#3F88DA', '#184C99'],
      parcel: ['#2FA472', '#11603F'],
      document: ['#8E73E6', '#4C32A6'],
    },
    tileShadow: '#000000',
    tileShadowOpacity: 0.4,
    glyph: '#F2F6FF',
    badge: '#E85A4F',
    done: '#2E9E6E',
    badgeRing: '#0B1B35',
    sparkle: '#FFE7A8',
    sparkleOpacity: 0.7,
  },
};

// ---- geometry (scene units, see `HeaderScene`) ---------------------------------------------------
// On a 402pt phone the toolbar (and the "Đọc tất cả" pill on the right) ends at y ≈ 131, the count's words end at
// x ≈ 220, and the tab tiles cover the foot from y ≈ 212: the picture keeps to x ≥ 230, y 132–212.

/** The bell hangs from its knob at `BELL`; local units, the knob's top at 0, the clapper's foot at ≈ 79. */
const BELL = { x: 316, y: 137, scale: 0.92 };
/** Swing while ringing, clockwise about the knob, so the mouth swings left and the waves ring out to the right. */
const SWING = 11;
const DOME =
  'M0 8C-16 8 -23 19 -23 33V44C-23 51 -27 56 -33 59.5C-35.5 61 -35 64 -32 64H32C35 64 35.5 61 33 59.5C27 56 23 51 23 44V33C23 19 16 8 0 8Z';
const SHINE = 'M-15 24C-13.5 17 -8.5 13 -2.5 12.5C-8 16.5 -10 22.5 -10.5 30V47C-10.5 50 -15.5 50 -15.5 47V31Z';
/** Sound waves to the right of the swinging bell, in scene units. */
const WAVES = 'M348 150Q355 159 351 170M356 143Q367 159 360 177';
const WAVES_LEFT = 'M283 154Q278 161 280 169';

/** The modules' app icons floating round the bell: `[x, y, size, tilt°]`, drawn on a 24-unit grid. */
type Tile = { x: number; y: number; size: number; tilt: number };
const TILES: Record<'meeting' | 'parcel' | 'document', Tile> = {
  meeting: { x: 236, y: 140, size: 27, tilt: -10 },
  document: { x: 244, y: 182, size: 23, tilt: 8 },
  parcel: { x: 364, y: 174, size: 25, tilt: 11 },
};
const TILE_BODY = 'M6.5 0H17.5A6.5 6.5 0 0 1 24 6.5V17.5A6.5 6.5 0 0 1 17.5 24H6.5A6.5 6.5 0 0 1 0 17.5V6.5A6.5 6.5 0 0 1 6.5 0Z';
/** White line glyphs like the app's icons: a calendar with a tick, a parcel box, a page with a folded corner. */
const GLYPHS = {
  meeting: 'M7.5 6.5H16.5A2.5 2.5 0 0 1 19 9V16.5A2.5 2.5 0 0 1 16.5 19H7.5A2.5 2.5 0 0 1 5 16.5V9A2.5 2.5 0 0 1 7.5 6.5ZM5 10.5H19M9 4.8V8M15 4.8V8M9.4 14.6L11.3 16.4L14.8 12.9',
  parcel: 'M12 4.6L18.6 8.2V15.8L12 19.4L5.4 15.8V8.2ZM5.4 8.2L12 11.8L18.6 8.2M12 11.8V19.4M8.7 6.4L15.3 10',
  document: 'M8 4.8H13.6L17.4 8.6V17.7A1.6 1.6 0 0 1 15.8 19.3H8.2A1.6 1.6 0 0 1 6.6 17.7V6.4A1.6 1.6 0 0 1 8.2 4.8ZM13.6 4.8V8.6H17.4M9.2 12.2H14.8M9.2 15.2H13.2',
};

/** A four-point twinkle. */
const sparkle = (x: number, y: number, r: number) =>
  `M${x} ${y - r}Q${x + r * 0.18} ${y - r * 0.18} ${x + r} ${y}Q${x + r * 0.18} ${y + r * 0.18} ${x} ${y + r}Q${x - r * 0.18} ${y + r * 0.18} ${x - r} ${y}Q${x - r * 0.18} ${y - r * 0.18} ${x} ${y - r}Z`;
const SPARKLES = sparkle(380, 150, 4.5) + sparkle(270, 136, 3) + sparkle(392, 196, 2.6);

/** Sky kept clear of the words: the status bar, the title (to x ≈ 205), the pill (x ≈ 280–390, y ≈ 96–131), the count. */
const CLOUDS: [number, number, number, number][] = [[236, 104, 0.5, 0.1], [96, 44, 0.6, 0.1], [200, 64, 0.45, 0.08]];
const STARS: [number, number, number][][] = [
  [[240, 92, 1.1], [150, 62, 0.9], [394, 140, 0.9], [226, 172, 0.9], [340, 205, 0.8]],
  [[262, 112, 0.8], [118, 70, 0.7], [62, 56, 0.7], [292, 204, 0.7]],
  [[180, 74, 0.6], [16, 68, 0.6], [240, 124, 0.6], [384, 126, 0.6]],
];

function AppTile({ kind, tile, colors }: { kind: keyof typeof TILES; tile: Tile; colors: (typeof palettes)['light'] }) {
  const s = tile.size / 24;
  return (
    <G transform={`translate(${tile.x} ${tile.y}) rotate(${tile.tilt} ${tile.size / 2} ${tile.size / 2}) scale(${s})`}>
      {/* A soft drop shadow: two offset copies, the wider one fainter. */}
      <Path d={TILE_BODY} transform="translate(0.6 2.6) scale(1.02)" fill={colors.tileShadow} fillOpacity={colors.tileShadowOpacity * 0.5} />
      <Path d={TILE_BODY} transform="translate(0.3 1.3)" fill={colors.tileShadow} fillOpacity={colors.tileShadowOpacity} />
      <Path d={TILE_BODY} fill={`url(#naTile_${kind})`} />
      <Path d={TILE_BODY} fill="url(#naTileGloss)" />
      <Path d={GLYPHS[kind]} stroke={colors.glyph} strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </G>
  );
}

/**
 * The notifications header's picture over the shared sky and skyline (`HeaderScene`): a polished brass bell floating
 * over its shadow, with the app icons of the modules whose notifications land here (meeting, parcel, document)
 * around it. While something is unread (`ringing`) the bell swings with sound waves and a red badge; once all is read
 * it hangs still with a green tick.
 */
export const NotificationsHeaderArt = memo(function NotificationsHeaderArt({ ringing }: { ringing: boolean }) {
  return (
    <HeaderScene id="na" clouds={CLOUDS} stars={STARS}>
      {(night) => {
        const c = palettes[night ? 'dark' : 'light'];
        const swing = ringing ? SWING : 0;
        return (
          <>
            <Defs>
              <LinearGradient id="naBell" x1="0" y1="0" x2="1" y2="0">
                <Stop offset="0" stopColor={c.bell[0]} />
                <Stop offset="0.32" stopColor={c.bell[1]} />
                <Stop offset="0.72" stopColor={c.bell[2]} />
                <Stop offset="1" stopColor={c.bell[3]} />
              </LinearGradient>
              {/* Light pooling on the shoulder, top left. */}
              <RadialGradient id="naBellGlow" cx="0.34" cy="0.24" r="0.55">
                <Stop offset="0" stopColor={c.bellGlow} stopOpacity={0.85} />
                <Stop offset="1" stopColor={c.bellGlow} stopOpacity={0} />
              </RadialGradient>
              <LinearGradient id="naLip" x1="0" y1="0" x2="1" y2="0">
                <Stop offset="0" stopColor={c.lip[0]} />
                <Stop offset="1" stopColor={c.lip[1]} />
              </LinearGradient>
              <RadialGradient id="naClapper" cx="0.35" cy="0.3" r="0.75">
                <Stop offset="0" stopColor={c.clapper[0]} />
                <Stop offset="1" stopColor={c.clapper[1]} />
              </RadialGradient>
              <RadialGradient id="naShadow" cx="0.5" cy="0.5" r="0.5">
                <Stop offset="0" stopColor={c.shadow} stopOpacity={c.shadowOpacity} />
                <Stop offset="1" stopColor={c.shadow} stopOpacity={0} />
              </RadialGradient>
              {(Object.keys(TILES) as (keyof typeof TILES)[]).map((kind) => (
                <LinearGradient key={kind} id={`naTile_${kind}`} x1="0" y1="0" x2="0.35" y2="1">
                  <Stop offset="0" stopColor={c.tiles[kind][0]} />
                  <Stop offset="1" stopColor={c.tiles[kind][1]} />
                </LinearGradient>
              ))}
              <LinearGradient id="naTileGloss" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor="#FFFFFF" stopOpacity={0.32} />
                <Stop offset="0.5" stopColor="#FFFFFF" stopOpacity={0.04} />
                <Stop offset="1" stopColor="#FFFFFF" stopOpacity={0} />
              </LinearGradient>
            </Defs>

            {/* Shadow on the haze under the floating bell, narrower while it swings away. */}
            <Ellipse cx={BELL.x - (ringing ? 7 : 0)} cy={208} rx={ringing ? 30 : 34} ry={4.5} fill="url(#naShadow)" />

            {(Object.keys(TILES) as (keyof typeof TILES)[]).map((kind) => (
              <AppTile key={kind} kind={kind} tile={TILES[kind]} colors={c} />
            ))}

            {ringing ? (
              <Path d={WAVES + WAVES_LEFT} stroke={c.waves} strokeOpacity={c.wavesOpacity} strokeWidth={2.2} strokeLinecap="round" fill="none" />
            ) : null}

            <G transform={`translate(${BELL.x} ${BELL.y}) scale(${BELL.scale}) rotate(${swing} 0 4)`}>
              {/* Clapper, lagging behind the swing. */}
              <Circle cx={ringing ? -6 : 0} cy={71} r={6.8} fill="url(#naClapper)" />
              {/* Knob, dome with its sheen and shine, lip with a lit top edge. */}
              <Circle cx={0} cy={4.6} r={4.8} fill="url(#naLip)" />
              <Circle cx={-1.4} cy={3.4} r={1.6} fill={c.shine} fillOpacity={c.shineOpacity} />
              <Path d={DOME} fill="url(#naBell)" />
              <Path d={DOME} fill="url(#naBellGlow)" />
              <Path d={SHINE} fill={c.shine} fillOpacity={c.shineOpacity} />
              <Rect x={-36} y={61} width={72} height={7.5} rx={3.75} fill="url(#naLip)" />
              <Path d="M-31 62H31" stroke={c.lipEdge} strokeOpacity={0.8} strokeWidth={1.1} strokeLinecap="round" />
              {/* Red badge while unread, a green tick once all is read. */}
              <Circle cx={19} cy={15} r={10} fill={c.badgeRing} />
              <Circle cx={19} cy={15} r={7.8} fill={ringing ? c.badge : c.done} />
              {ringing ? (
                <Circle cx={16.8} cy={12.6} r={2.2} fill="#FFFFFF" fillOpacity={0.45} />
              ) : (
                <Path d="M15.4 15.2L17.9 17.6L22.6 12.7" stroke="#FFFFFF" strokeWidth={2.1} strokeLinecap="round" strokeLinejoin="round" fill="none" />
              )}
            </G>

            <Path d={SPARKLES} fill={c.sparkle} fillOpacity={c.sparkleOpacity} />
          </>
        );
      }}
    </HeaderScene>
  );
});
