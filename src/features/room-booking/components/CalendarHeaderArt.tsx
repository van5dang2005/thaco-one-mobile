import { memo } from 'react';
import { StyleSheet } from 'react-native';
import Svg, { Circle, ClipPath, Defs, G, LinearGradient, Path, RadialGradient, Rect, Stop } from 'react-native-svg';

import { useTheme } from '@/core/theme/ThemeProvider';

/** The drawing is 400 × 300 with the ground on the header's bottom edge (`xMidYMax slice`). */
const GROUND = 300;

/**
 * Day: brand blue in the sun, light rays and clouds, Sofic's glass catching the light. Night: a navy sky with stars,
 * Sofic's floors lit in blue, a few offices and the mall's shop fronts still on, red beacons; close to the dark headers
 * elsewhere. Neither sky gets lighter than #1767BA, and whatever sits behind the week band is dark, so the white
 * toolbar, month and week stay readable.
 */
const palettes = {
  light: {
    sky: ['#003F86', '#0A57A8', '#1767BA'],
    glow: '#CFE6FF',
    glowOpacity: 0.42,
    far: '#2670BF',
    haze: '#8CC4F5',
    hazeOpacity: 0.16,
    low: ['#14599F', '#18609F'],
    lowRibbon: '#7FB6EE',
    lowRibbonOpacity: 0.06,
    mid: ['#0F4E96', '#0B4486'],
    midTop: '#165AA5',
    ribbon: '#7FB6EE',
    ribbonOpacity: 0.14,
    fin: '#5D9EE3',
    finOpacity: 0.22,
    edge: '#CFE6FF',
    edgeOpacity: 0.7,
    beacon: '#B9DCFF',
    beaconOpacity: 0.8,
    // Sofic: sky-blue glass lit from the left, each floor a bright reflection over a dark spandrel.
    sofic: ['#4C98E2', '#86C2F6', '#3F8EDB', '#165AA5'],
    soficShade: '#062B57',
    soficShadeOpacity: 0.7,
    soficFloor: '#0B3F7C',
    soficFloorOpacity: 0.5,
    soficShine: '#E4F2FF',
    soficShineOpacity: 0.4,
    soficFacetOpacity: 0.08,
    lobby: '#0A3A70',
    column: '#CFE6FF',
    podium: ['#1A5FA8', '#0C4485'],
    podiumFin: '#8EC1F5',
    podiumFinOpacity: 0.18,
    shop: '#CFE6FF',
    shopOpacity: 0.35,
    tree: '#3E9A72',
    treeShade: '#2F8160',
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
    low: ['#0C1C33', '#0E2039'],
    lowRibbon: '#1E3556',
    lowRibbonOpacity: 0.6,
    mid: ['#0E2140', '#0B1B35'],
    midTop: '#13294B',
    ribbon: '#2A4466',
    ribbonOpacity: 0.7,
    fin: '#29507F',
    finOpacity: 0.35,
    edge: '#5AA2E6',
    edgeOpacity: 0.5,
    beacon: '#FF6B5E',
    beaconOpacity: 1,
    // Sofic at night: dark glass with a blue line glowing along every floor.
    sofic: ['#18385F', '#21497A', '#132D50', '#0A1C34'],
    soficShade: '#02070F',
    soficShadeOpacity: 0.6,
    soficFloor: '#040B16',
    soficFloorOpacity: 0.55,
    soficShine: '#8CC8FF',
    soficShineOpacity: 0.55,
    soficFacetOpacity: 0.04,
    lobby: '#060F1E',
    column: '#5AA2E6',
    podium: ['#14304F', '#0A1A31'],
    podiumFin: '#7FB8FF',
    podiumFinOpacity: 0.2,
    shop: '#FFD27A',
    shopOpacity: 0.6,
    tree: '#1F5550',
    treeShade: '#17443F',
    scrim: '#03070F',
    scrimOpacity: 0.55,
  },
};

// ---- geometry -----------------------------------------------------------------------------------
// Bottom-aligned, the header's rows land on fixed heights: toolbar y ≈ 84–122, area ≈ 149–174, month ≈ 181–212,
// week band ≈ 226–284 (less picture gap on short screens moves the upper rows down). Sofic Tower stands in the gap
// between the title and "Đặt phòng"; the left, under the back button, the area and the month, keeps to low blocks.

/** Far skyline in the haze, `[x, width, height]`. */
const FAR: [number, number, number][] = [
  [0, 16, 78], [14, 12, 96], [24, 18, 70], [40, 14, 104], [52, 20, 84], [70, 12, 112], [80, 16, 76], [94, 18, 98], [110, 14, 88],
  [122, 20, 108], [140, 12, 80], [150, 18, 100], [166, 14, 74], [178, 20, 92], [196, 12, 116], [206, 18, 86], [222, 14, 102],
  [234, 20, 78], [252, 12, 96], [262, 18, 110], [278, 14, 84], [290, 20, 100], [308, 12, 76], [318, 18, 106], [334, 14, 90],
  [346, 20, 112], [364, 12, 80], [374, 16, 98], [388, 14, 86],
];
/** Spires on three far towers, `[x, height]` above the tower under x. */
const FAR_SPIRES: [number, number][] = [[75, 12], [201, 10], [351, 12]];
/** Low blocks under the back button, the area and the month, `[x, width, top]`. */
const LOW: [number, number, number][] = [[-2, 46, 228], [42, 40, 208], [80, 50, 234], [126, 38, 216], [160, 46, 198]];
/** Blocks around the towers on the right, `[x, width, top]`. */
const MID: [number, number, number][] = [[284, 14, 206], [338, 30, 160], [366, 36, 140]];
/** A stepped tower with fins beside Sofic, half behind "Đặt phòng" and Ngày / Tuần. */
const STEPPED = { x: 292, w: 46, top: 150, setX: 300, setW: 30, setTop: 138, antenna: 126 };
/**
 * Sofic Tower (10 Mai Chí Thọ, Thủ Thiêm), where Văn phòng SOFIC is: banded blue glass flaring towards the top, its roof
 * a curve falling to the right. The edges and roof are quadratic curves from the bottom corners (`bl`, `br` at `base`)
 * to the top ones (`tl` at `topL`, `tr` at `topR`).
 */
const SOFIC = { base: 236, bl: 215, br: 281, tl: 206, tr: 290, topL: 96, topR: 112, roofX: 246, roofY: 91 };
/** The recessed floor of columns between the tower and the mall. */
const LOBBY = { top: 236, bottom: 248, x0: 219, x1: 277 };
/** Thiso Mall, the long glass podium; behind the week band, so only its fins and, below the band, its shop fronts show. */
const PODIUM = { x0: 190, x1: 360, top: 248 };
/** Street trees in the strip under the week band, `[x, y, radius]`. */
const TREES: [number, number, number][] = [[150, 293, 5], [178, 294, 4], [372, 293, 5], [394, 294.5, 4]];
/** Day clouds, `[x, y, scale, opacity]`: two drift through the gap between the toolbar and the area. */
const CLOUDS: [number, number, number, number][] = [[150, 128, 0.9, 0.14], [318, 136, 0.7, 0.16], [52, 72, 0.6, 0.1], [384, 76, 0.55, 0.12]];
/** Night stars, `[x, y, radius]`, in three brightnesses. */
const STARS: { opacity: number; points: [number, number, number][] }[] = [
  { opacity: 0.8, points: [[70, 112, 1.1], [176, 118, 1.2], [262, 72, 1], [380, 104, 1.1], [330, 80, 0.9], [128, 106, 0.9]] },
  { opacity: 0.55, points: [[18, 120, 0.9], [104, 136, 0.7], [196, 150, 0.7], [298, 128, 0.9], [352, 128, 0.8], [230, 72, 0.9], [100, 80, 0.8], [160, 70, 0.7]] },
  { opacity: 0.4, points: [[44, 150, 0.7], [152, 140, 0.8], [276, 82, 0.7], [392, 150, 0.7], [324, 176, 0.7], [60, 176, 0.7], [140, 184, 0.6], [8, 166, 0.7]] },
];
/** Day light rays fanning from the top-right corner. */
const RAYS = 'M412 20L120 176L160 200ZM412 20L40 150L64 170ZM412 20L220 236L258 246Z';
/** Night lights stop above the week band, so the dates never sit on a scatter of dots. */
const LIT_BELOW = 224;

// ---- paths, built once: a few <Path>s instead of hundreds of <Rect>s ------------------------------

const r2 = (v: number) => Math.round(v * 100) / 100;
/** A rectangle drawn clockwise, like every shape here: overlapping shapes of one path then fill once. */
const box = (x: number, y: number, w: number, h: number) => `M${r2(x)} ${r2(y)}h${r2(w)}v${r2(h)}h${r2(-w)}Z`;
const disc = (cx: number, cy: number, r: number) => `M${r2(cx - r)} ${r2(cy)}a${r2(r)} ${r2(r)} 0 1 1 ${r2(2 * r)} 0a${r2(r)} ${r2(r)} 0 1 1 ${r2(-2 * r)} 0Z`;
const pill = (x: number, y: number, w: number, h: number) => {
  const r = h / 2;
  return `M${r2(x + r)} ${r2(y)}h${r2(w - h)}a${r2(r)} ${r2(r)} 0 0 1 0 ${r2(h)}h${r2(h - w)}a${r2(r)} ${r2(r)} 0 0 1 0 ${r2(-h)}Z`;
};
/** Steps from `from` while below `to`. */
const steps = (from: number, to: number, step: number) => Array.from({ length: Math.max(0, Math.ceil((to - from) / step)) }, (_, i) => from + i * step);
/** The same scatter on every render: which windows are lit. */
const hash = (a: number, b: number, seed: number) => ((a * 73856093) ^ (b * 19349663) ^ (seed * 83492791)) >>> 0;

/** Ribbon windows of a row of blocks: `height` tall every `step`, from `offset` under each top. */
const ribbons = (blocks: [number, number, number][], offset: number, step: number, height: number) =>
  blocks.flatMap(([x, w, top]) => steps(top + offset, GROUND, step).map((y) => box(x + 3, y, w - 6, height))).join('');

const FAR_PATH = [
  ...FAR.map(([x, w, h]) => box(x, GROUND - h, w, h)),
  ...FAR_SPIRES.map(([x, h]) => {
    const top = GROUND - (FAR.find(([fx, fw]) => x >= fx && x < fx + fw)?.[2] ?? 0);
    return box(x, top - h, 1.6, h);
  }),
].join('');
const LOW_PATHS = [0, 1].map((odd) => LOW.filter((_, i) => i % 2 === odd).map(([x, w, top]) => box(x, top, w, GROUND - top)).join('') + (odd ? '' : box(170, 192, 14, 6)));
const MID_PATHS = [0, 1].map((odd) => MID.filter((_, i) => i % 2 === odd).map(([x, w, top]) => box(x, top, w, GROUND - top)).join(''));
const LOW_RIBBONS = ribbons(LOW, 6, 8, 2.4);
const MID_RIBBONS = ribbons(MID, 7, 9, 3);

const STEPPED_BODY = box(STEPPED.setX, STEPPED.setTop, STEPPED.setW, STEPPED.top - STEPPED.setTop) + box(STEPPED.x, STEPPED.top, STEPPED.w, GROUND - STEPPED.top) + box(STEPPED.x + STEPPED.w / 2 - 0.7, STEPPED.antenna, 1.4, STEPPED.setTop - STEPPED.antenna);
const STEPPED_FINS = [
  ...steps(STEPPED.x + 4, STEPPED.x + STEPPED.w - 2, 5).map((x) => box(x, STEPPED.top + 3, 1.2, GROUND - STEPPED.top - 3)),
  ...steps(STEPPED.setX + 4, STEPPED.setX + STEPPED.setW - 2, 5).map((x) => box(x, STEPPED.setTop + 3, 1.2, STEPPED.top - STEPPED.setTop - 3)),
].join('');
const STEPPED_ROOFS = box(STEPPED.x, STEPPED.top, STEPPED.w, 1.5) + box(STEPPED.setX, STEPPED.setTop, STEPPED.setW, 1.5);

const SOFIC_ROOF = `M${SOFIC.tl} ${SOFIC.topL}Q${SOFIC.roofX} ${SOFIC.roofY} ${SOFIC.tr} ${SOFIC.topR}`;
const SOFIC_OUTLINE = `M${SOFIC.bl} ${SOFIC.base}Q${SOFIC.bl - 5} 172 ${SOFIC.tl} ${SOFIC.topL}Q${SOFIC.roofX} ${SOFIC.roofY} ${SOFIC.tr} ${SOFIC.topR}Q${SOFIC.br + 6} 182 ${SOFIC.br} ${SOFIC.base}Z`;
/** Inside the outline's clip: dark spandrels and bright reflections every 5.5, faint facets every 8. */
const SOFIC_FLOORS = steps(SOFIC.topL + 4, SOFIC.base, 5.5).map((y) => box(200, y, 100, 1.3)).join('');
const SOFIC_SHINE = steps(SOFIC.topL + 6.6, SOFIC.base, 5.5).map((y) => box(200, y, 100, 0.8)).join('');
const SOFIC_FACETS = steps(SOFIC.tl + 8, SOFIC.tr, 8).map((x) => box(x, 80, 0.7, 160)).join('');
const LOBBY_BODY = box(LOBBY.x0, LOBBY.top, LOBBY.x1 - LOBBY.x0, LOBBY.bottom - LOBBY.top);
const LOBBY_COLUMNS = steps(LOBBY.x0 + 3, LOBBY.x1, 6.5).map((x) => box(x, LOBBY.top, 1.6, LOBBY.bottom - LOBBY.top)).join('');

const PODIUM_BODY = box(PODIUM.x0, PODIUM.top, PODIUM.x1 - PODIUM.x0, GROUND - PODIUM.top);
const PODIUM_FINS = steps(PODIUM.x0 + 3, PODIUM.x1 - 1, 5).map((x) => box(x, PODIUM.top + 3, 1, GROUND - PODIUM.top - 13)).join('');
const PODIUM_ROOF = box(PODIUM.x0, PODIUM.top, PODIUM.x1 - PODIUM.x0, 1.6);
const SHOPS = steps(PODIUM.x0 + 4, PODIUM.x1 - 8, 12).map((x) => box(x, 289.5, 8, 6)).join('');
const TREE_PATH = TREES.map(([x, y, r]) => disc(x, y, r)).join('');
const TREE_SHADE = TREES.map(([x, y, r]) => disc(x + r * 0.45, y + r * 0.3, r * 0.6)).join('');

const CLOUD_PATHS = CLOUDS.map(([x, y, s, opacity]) => ({
  opacity,
  d: pill(x - 24 * s, y, 48 * s, 8 * s) + disc(x - 10 * s, y + s, 7.5 * s) + disc(x + 3 * s, y - 2 * s, 10 * s) + disc(x + 15 * s, y + 2 * s, 6.5 * s),
}));
const STAR_PATHS = STARS.map(({ opacity, points }) => ({ opacity, d: points.map(([x, y, r]) => disc(x, y, r)).join('') }));

/** Lit windows at night, warm and a few cool: single windows on the blocks, a few offices along Sofic's floors. */
const LIT = (() => {
  const warm: string[] = [];
  const cool: string[] = [];
  /** Windows `w` × `h` on a block's rows (`offset` under its top, every `step`), lit one in `every`. */
  const scatter = ([x, width, top]: [number, number, number], offset: number, step: number, w: number, h: number, every: number, seed: number) =>
    steps(top + offset, LIT_BELOW, step).forEach((y) =>
      steps(x + 4, x + width - 6, 6).forEach((wx) => {
        if (hash(wx, y, seed) % every === 0) warm.push(box(wx, y, w, h));
      }),
    );
  LOW.forEach((block) => scatter(block, 6, 8, 4, 2.4, 7, 3));
  MID.forEach((block) => scatter(block, 7, 9, 4, 3, 9, 5));
  steps(STEPPED.setTop + 6, LIT_BELOW, 7).forEach((y) =>
    steps(STEPPED.x + 1, STEPPED.x + STEPPED.w - 3, 5).forEach((x) => {
      const inside = y >= STEPPED.top || (x >= STEPPED.setX && x < STEPPED.setX + STEPPED.setW - 3);
      if (inside && hash(x, y, 11) % 9 === 0) (hash(x, y, 2) % 3 ? warm : cool).push(box(x + 1.6, y, 2.8, 3.4));
    }),
  );
  steps(SOFIC.topL + 15.5, LIT_BELOW, 5.5).forEach((y) => {
    const h = hash(SOFIC.tl, Math.round(y * 2), 13);
    if (h % 4) return;
    warm.push(box(SOFIC.tl + 12 + (h % 44), y - 3.4, 5 + ((h >>> 4) % 7), 2));
  });
  return { warm: warm.join(''), cool: cool.join('') };
})();

/**
 * The room calendar header's picture: the Sofic Tower / Thiso Mall Sala complex among the district, by day or by night
 * with the theme. A hazy far skyline runs along the bottom under low blocks on the left; Sofic rises between the title
 * and "Đặt phòng" over its floor of columns and the mall's long podium, beside a stepped tower. Day adds rays and
 * clouds; night stars, glowing floors, lit windows and shop fronts, red beacons. A scrim at the top keeps the status bar
 * readable.
 */
export const CalendarHeaderArt = memo(function CalendarHeaderArt() {
  const { scheme } = useTheme();
  const c = palettes[scheme];
  const night = scheme === 'dark';
  return (
    // Sized by absoluteFill alone: percentage sizes on an absolute child resolve against the header's padded content box.
    <Svg pointerEvents="none" viewBox="0 0 400 300" preserveAspectRatio="xMidYMax slice" style={StyleSheet.absoluteFill}>
      <Defs>
        <LinearGradient id="rcSky" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={c.sky[0]} />
          <Stop offset="0.55" stopColor={c.sky[1]} />
          <Stop offset="1" stopColor={c.sky[2]} />
        </LinearGradient>
        <RadialGradient id="rcGlow" cx="372" cy="60" r="240" gradientUnits="userSpaceOnUse">
          <Stop offset="0" stopColor={c.glow} stopOpacity={c.glowOpacity} />
          <Stop offset="1" stopColor={c.glow} stopOpacity={0} />
        </RadialGradient>
        <LinearGradient id="rcHaze" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={c.haze} stopOpacity={0} />
          <Stop offset="1" stopColor={c.haze} stopOpacity={c.hazeOpacity} />
        </LinearGradient>
        <LinearGradient id="rcMid" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={c.midTop} />
          <Stop offset="1" stopColor={c.mid[1]} />
        </LinearGradient>
        {/* Sofic's glass, lightest left of centre where it faces the light; darker towards the base. */}
        <LinearGradient id="rcSofic" x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0" stopColor={c.sofic[0]} />
          <Stop offset="0.3" stopColor={c.sofic[1]} />
          <Stop offset="0.6" stopColor={c.sofic[2]} />
          <Stop offset="1" stopColor={c.sofic[3]} />
        </LinearGradient>
        <LinearGradient id="rcSoficShade" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={c.soficShade} stopOpacity={0} />
          <Stop offset="1" stopColor={c.soficShade} stopOpacity={c.soficShadeOpacity} />
        </LinearGradient>
        <LinearGradient id="rcPodium" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={c.podium[0]} />
          <Stop offset="1" stopColor={c.podium[1]} />
        </LinearGradient>
        <LinearGradient id="rcScrim" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={c.scrim} stopOpacity={c.scrimOpacity} />
          <Stop offset="0.5" stopColor={c.scrim} stopOpacity={0} />
        </LinearGradient>
        <ClipPath id="rcSoficClip">
          <Path d={SOFIC_OUTLINE} />
        </ClipPath>
      </Defs>
      <Rect width={400} height={300} fill="url(#rcSky)" />
      <Rect width={400} height={300} fill="url(#rcGlow)" />
      {night ? (
        STAR_PATHS.map(({ opacity, d }) => <Path key={opacity} d={d} fill="#FFFFFF" fillOpacity={opacity} />)
      ) : (
        <>
          <Path d={RAYS} fill="#FFFFFF" fillOpacity={0.045} />
          {CLOUD_PATHS.map(({ opacity, d }, i) => (
            <Path key={i} d={d} fill="#FFFFFF" fillOpacity={opacity} />
          ))}
        </>
      )}

      {/* Far skyline, then haze over it towards the ground. */}
      <Path d={FAR_PATH} fill={c.far} />
      <Rect y={200} width={400} height={100} fill="url(#rcHaze)" />

      <Path d={LOW_PATHS[0]} fill={c.low[0]} />
      <Path d={LOW_PATHS[1]} fill={c.low[1]} />
      <Path d={LOW_RIBBONS} fill={c.lowRibbon} fillOpacity={c.lowRibbonOpacity} />
      <Path d={MID_PATHS[0]} fill={c.mid[0]} />
      <Path d={MID_PATHS[1]} fill={c.mid[1]} />
      <Path d={MID_RIBBONS} fill={c.ribbon} fillOpacity={c.ribbonOpacity} />

      {/* Stepped tower: fins, a lit roof edge on each step, an antenna. */}
      <Path d={STEPPED_BODY} fill="url(#rcMid)" />
      <Path d={STEPPED_FINS} fill={c.fin} fillOpacity={c.finOpacity} />
      <Path d={STEPPED_ROOFS} fill={c.edge} fillOpacity={c.edgeOpacity * 0.6} />
      <Circle cx={STEPPED.x + STEPPED.w / 2} cy={STEPPED.antenna} r={1.5} fill={c.beacon} fillOpacity={c.beaconOpacity} />

      {/* Thiso Mall: the glass podium with fins and its shop fronts at street level, under the floor of columns. */}
      <Path d={PODIUM_BODY} fill="url(#rcPodium)" />
      <Path d={PODIUM_FINS} fill={c.podiumFin} fillOpacity={c.podiumFinOpacity} />
      <Path d={PODIUM_ROOF} fill={c.edge} fillOpacity={c.edgeOpacity * 0.7} />
      <Path d={SHOPS} fill={c.shop} fillOpacity={c.shopOpacity} />
      <Path d={LOBBY_BODY} fill={c.lobby} />
      <Path d={LOBBY_COLUMNS} fill={c.column} fillOpacity={0.3} />

      {/* Sofic Tower: the glass, its floors clipped to the outline, the lit curve of the roof. */}
      <Path d={SOFIC_OUTLINE} fill="url(#rcSofic)" />
      <G clipPath="url(#rcSoficClip)">
        <Path d={SOFIC_FACETS} fill="#FFFFFF" fillOpacity={c.soficFacetOpacity} />
        <Path d={SOFIC_FLOORS} fill={c.soficFloor} fillOpacity={c.soficFloorOpacity} />
        <Path d={SOFIC_SHINE} fill={c.soficShine} fillOpacity={c.soficShineOpacity} />
        <Rect x={200} y={150} width={100} height={90} fill="url(#rcSoficShade)" />
      </G>
      <Path d={SOFIC_ROOF} stroke={c.edge} strokeOpacity={c.edgeOpacity} strokeWidth={1.6} fill="none" />

      <Path d={TREE_PATH} fill={c.tree} />
      <Path d={TREE_SHADE} fill={c.treeShade} />

      {night ? (
        <>
          <Path d={LIT.warm} fill="#FFD27A" fillOpacity={0.68} />
          <Path d={LIT.cool} fill="#A9D2FA" fillOpacity={0.5} />
        </>
      ) : null}

      <Rect width={400} height={300} fill="url(#rcScrim)" />
    </Svg>
  );
});
