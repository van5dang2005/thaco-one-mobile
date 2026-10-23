import { useWindowDimensions, View } from 'react-native';
import Svg, { Defs, G, Image as SvgImage, LinearGradient, Path, RadialGradient, Rect, Stop } from 'react-native-svg';

import { useTheme } from '@/core/theme/ThemeProvider';
import { images, WORDMARK_RATIO } from '@/shared/assets';
import { box, disc, steps } from '@/shared/ui/HeaderScene';

import { guestPageColors } from './GuestPage';

/** Drawing box of the scene. It is drawn the screen's width wide (scaled as for at most `MAX_WIDTH`), keeping the ratio. */
const VIEW_W = 390;
const VIEW_H = 300;
const MAX_WIDTH = 430;
/** Where the plant stands; under it the page's own grey runs on down. */
const GROUND = 190;
/** How far the sky goes on above the drawing (it tucks 2pt under the drawing's top, so no seam shows between them). */
const SKY_ABOVE = 1200;
/** Level with the top of the screen's toolbar. */
const TOOLBAR = 24;

/**
 * A blue sky lightening to the horizon, with a glow rising behind the gate. Behind the gate stands the headquarters:
 * `frame` and `wing` are white veils over the sky, its `glass` a deeper blue. The
 * near plane is cut out in the page's grey (`land`), with `pane` glass in it.
 */
const palettes = {
  light: {
    sky: ['#003E80', '#0A5BAF', '#4793DA'],
    glow: { color: '#FFFFFF', opacity: 0.3 },
    frame: 0.34,
    wing: 0.26,
    glass: { color: '#0A4E98', opacity: 0.42 },
    land: guestPageColors.light,
    pane: '#D2DBE6',
    sign: '#00539B',
    stripe: '#E5484D',
    lit: '#FFE3A3',
    cloud: 0.14,
  },
  dark: {
    sky: ['#071224', '#0D2342', '#1D4270'],
    glow: { color: '#8FBFFF', opacity: 0.18 },
    frame: 0.13,
    wing: 0.09,
    glass: { color: '#050C18', opacity: 0.5 },
    land: guestPageColors.dark,
    pane: '#16283F',
    sign: '#1C4F86',
    stripe: '#E2574C',
    lit: '#F2C46E',
    cloud: 0,
  },
};

// ---- behind the gate: the THACO headquarters ----------------------------------------------------

/** The tower: a solid crown carrying the THACO sign under a roof cap, then a curtain wall of glass in white mullions. */
const TOWER = { x: 222, y: 68, w: 100, crown: 24 };
const SIGN = { x: TOWER.x + 8, y: TOWER.y + 5, w: TOWER.w - 16, h: 15 };
const LOGO_H = 9.5;
const LOGO_W = LOGO_H * WORDMARK_RATIO;
/** The lower wing on the tower's right, with ribbon windows. */
const WING = { x: TOWER.x + TOWER.w, y: 132, w: 56 };
const HQ_FRAME = box(TOWER.x - 2, TOWER.y - 3, TOWER.w + 4, 3) + box(TOWER.x, TOWER.y, TOWER.w, GROUND - TOWER.y);
/** Curtain-wall panes, `[x, y]`: a row per floor under the crown. */
const towerPanes = steps(TOWER.y + TOWER.crown + 4, GROUND - 6, 11).flatMap((y) => steps(TOWER.x + 6, TOWER.x + TOWER.w - 6, 10).map((x) => [x, y] as const));
const HQ_GLASS =
  towerPanes.map(([x, y]) => box(x, y, 8, 8.5)).join('') + steps(WING.y + 8, GROUND - 6, 12).map((y) => box(WING.x + 4, y, WING.w - 8, 5)).join('');
const HQ_LIT = towerPanes
  .filter((_, i) => i % 7 === 3 || i % 11 === 5)
  .map(([x, y]) => box(x, y, 8, 8.5))
  .join('');

// ---- the near plane: the gate, the guard booth and the fence either side --------------------------

/**
 * The gate, centred on the middle of the drawing so the fence runs the same length on both sides: the glass guard house
 * standing in the fence line (under a thin roof, on a plinth, its glass split in three by mullions), then the lane,
 * closed by the barrier from its cabinet by the guard house to the first fence pillar on the right. A frame spans the
 * two (see `FRAME`).
 */
const MIDDLE = VIEW_W / 2;
const BOOTH = { x: MIDDLE - 48, y: 156, w: 28 };
const BOOTH_PATH = box(BOOTH.x - 3, BOOTH.y - 3, BOOTH.w + 6, 3) + box(BOOTH.x, BOOTH.y, BOOTH.w, GROUND - BOOTH.y) + box(BOOTH.x - 1.5, GROUND - 4, BOOTH.w + 3, 4);
const BOOTH_WINDOW = box(BOOTH.x + 3, BOOTH.y + 4, BOOTH.w - 6, 14);
const BOOTH_MULLIONS = [1, 2].map((i) => box(BOOTH.x + 3 + ((BOOTH.w - 6) * i) / 3 - 0.5, BOOTH.y + 4, 1, 14)).join('');
const LANE = { from: BOOTH.x + BOOTH.w + 3, to: MIDDLE + 48 };
const ARM_Y = 175;
const ARM_FROM = LANE.from + 3;
const BARRIER_PATH = box(LANE.from, ARM_Y - 3, 6, GROUND - ARM_Y + 3);
const ARM = `M${ARM_FROM} ${ARM_Y}H${LANE.to}`;
/** Red bands along the arm, as parts of its length from the cabinet. */
const ARM_STRIPES = [[0.16, 0.3], [0.44, 0.58], [0.72, 0.86]]
  .map(([a, b]) => `M${ARM_FROM + (LANE.to - ARM_FROM) * a} ${ARM_Y}H${ARM_FROM + (LANE.to - ARM_FROM) * b}`)
  .join('');

/** The fence's plinth top, where the camera pole stands. */
const FENCE_PLINTH = 184;

// ---- security: cameras watching the lane, the barrier's signal on red, a no-entry sign on the arm ----

/** A CCTV camera on a short bracket at `(x, y)`, facing `side`, with its red light at the back. */
const camera = (x: number, y: number, side: 1 | -1) =>
  box(x - 0.6, y - 4, 1.2, 4) + `M${x - 2 * side} ${y - 7.5}H${x + 6 * side}L${x + 7.5 * side} ${y - 4.5}H${x - 0.5 * side}Z`;
/** One on the guard house's roof, one on a pole across the lane; `[x, y, side]` of each mount. */
const CAMERAS: [number, number, 1 | -1][] = [
  [BOOTH.x + BOOTH.w - 2, BOOTH.y - 3, 1],
  [LANE.to + 19, 152, -1],
];
const CAMERA_POLE = box(LANE.to + 18.3, 152, 1.4, FENCE_PLINTH - 152);
const CAMERA_LEDS = CAMERAS.map(([x, y, side]) => disc(x - side, y - 6, 0.6)).join('');
/** The signal on the barrier's cabinet: a housing with a red light (on, the barrier being closed) over a green one. */
const SIGNAL = { x: LANE.from + 3, top: ARM_Y - 13 };
const SIGNAL_PATH = box(SIGNAL.x - 2.5, SIGNAL.top, 5, 8.5) + box(SIGNAL.x - 0.6, SIGNAL.top + 8.5, 1.2, 1.5);
const SIGNAL_RED = disc(SIGNAL.x, SIGNAL.top + 2.3, 1.3);
const SIGNAL_GREEN = disc(SIGNAL.x, SIGNAL.top + 6.1, 1.3);
/** The no-entry sign hanging from the middle of the arm: a red disc with a white bar. */
const NO_ENTRY = { x: (ARM_FROM + LANE.to) / 2, y: ARM_Y + 6.5, r: 4 };
/**
 * The fence either side of the gate, estate style: a low stone plinth, pillars on it with a cap and a ball finial, and
 * between them spear-topped railings whose tips and top rail dip in a gentle curve. On the left it ends at the guard
 * house, on the right it starts at the lane with the pillar the barrier rests on, mirrored about the middle.
 */
const FENCE = { plinth: FENCE_PLINTH, pillarW: 7, pillarTop: 170, rail: 172, lowRail: 180, tip: 171, sag: 3.2, bar: 1.1, pitch: 4, bay: 38 };
const BAYS = 6;
const fenceLeft = Array.from({ length: BAYS }, (_, i) => BOOTH.x - FENCE.pillarW - FENCE.bay * i).reverse();
const fenceRight = Array.from({ length: BAYS }, (_, i) => LANE.to + FENCE.bay * i);
const fencePillars = [...fenceLeft, ...fenceRight];
/** A railing between `a` and `q`: the dipping top rail, a low rail, and spear-topped bars whose tips follow the dip. */
function railing(a: number, q: number) {
  const { plinth, rail, lowRail, tip, sag, bar, pitch } = FENCE;
  const mid = (a + q) / 2;
  const dip = (x: number) => {
    const t = (x - a) / (q - a);
    return 4 * t * (1 - t) * sag;
  };
  let d = `M${a} ${rail}Q${mid} ${rail + 2 * sag} ${q} ${rail}V${rail + 1.2}Q${mid} ${rail + 1.2 + 2 * sag} ${a} ${rail + 1.2}Z` + box(a, lowRail, q - a, 1.1);
  for (const x of steps(a + 2.4, q - 1.4, pitch)) {
    const base = tip + dip(x + bar / 2);
    d += box(x, base, bar, plinth - base) + `M${x - 0.9} ${base}L${x + bar / 2} ${base - 2.6}L${x + bar + 0.9} ${base}Z`;
  }
  return d;
}
const FENCE_PATH = (() => {
  const { plinth, pillarW: w, pillarTop } = FENCE;
  let d = box(fenceLeft[0], plinth, BOOTH.x - fenceLeft[0], GROUND - plinth) + box(LANE.to, plinth, fenceRight[BAYS - 1] + w - LANE.to, GROUND - plinth);
  for (const p of fencePillars) d += box(p, pillarTop, w, plinth - pillarTop) + box(p - 1.2, pillarTop - 2.2, w + 2.4, 2.2) + box(p + w / 2 - 0.8, pillarTop - 4.6, 1.6, 2.4);
  for (const run of [fenceLeft, fenceRight]) run.slice(1).forEach((q, k) => (d += railing(run[k] + w, q)));
  return d;
})();
/**
 * The frame over the main gate: slim posts rising from the two fence pillars either side of it, carrying a capped beam
 * across the guard house and the lane, with a band of glass along its face (lit at night).
 */
const FRAME = { post: 5, top: 134, beam: 9 };
const framePillars = [fenceLeft[BAYS - 1], fenceRight[0]];
const FRAME_POSTS = framePillars.map((p) => p + FENCE.pillarW / 2 - FRAME.post / 2);
const FRAME_SPAN = { from: FRAME_POSTS[0] - 4, to: FRAME_POSTS[1] + FRAME.post + 4 };
const FRAME_PATH =
  FRAME_POSTS.map((x) => box(x, FRAME.top, FRAME.post, FENCE.plinth - FRAME.top)).join('') +
  box(FRAME_SPAN.from - 1.5, FRAME.top - 2, FRAME_SPAN.to - FRAME_SPAN.from + 3, 2) +
  box(FRAME_SPAN.from, FRAME.top, FRAME_SPAN.to - FRAME_SPAN.from, FRAME.beam);
const FRAME_BAND = box(FRAME_SPAN.from + 5, FRAME.top + 3, FRAME_SPAN.to - FRAME_SPAN.from - 10, 3);

/** The fence's finials (lit at night; none on the pillars carrying the frame), and the recessed panel on each pillar's face in the glass tone. */
const finialPillars = fencePillars.filter((p) => !framePillars.includes(p));
const FINIALS = finialPillars.map((p) => disc(p + FENCE.pillarW / 2, FENCE.pillarTop - 5.6, 2)).join('');
const PILLAR_PANELS = fencePillars.map((p) => box(p + 2, FENCE.pillarTop + 3, FENCE.pillarW - 4, 8)).join('');

const STARS: [number, number, number][] = [[300, 30, 1], [340, 52, 0.8], [372, 22, 1.1], [268, 76, 0.8], [24, 96, 0.9], [84, 84, 0.8], [126, 94, 0.7], [362, 100, 0.8]];
/** Day clouds, `[x, y, scale]`, kept off the title. */
const CLOUDS: [number, number, number][] = [[318, 40, 1]];
const cloud = ([x, y, s]: [number, number, number]) =>
  box(x - 22 * s, y, 44 * s, 8 * s) + disc(x - 10 * s, y + s, 7.5 * s) + disc(x + 3 * s, y - 2 * s, 10 * s) + disc(x + 15 * s, y + 2 * s, 6.5 * s);

/** How far below the ground line a header that stops under the gate cuts the picture. */
const GATE_CUT = 8;

/**
 * The scene at the current screen width: the drawing's height, how far it rises above the toolbar's top (`lift`), how
 * far below the toolbar's top the gate stands (`ground`), and where a header cut just under the gate ends (`gate`), for
 * screens without the counters.
 */
export function useGuestScene() {
  const { width } = useWindowDimensions();
  const scale = Math.min(width, MAX_WIDTH) / VIEW_W;
  return { height: VIEW_H * scale, lift: TOOLBAR * scale, ground: (GROUND - TOOLBAR) * scale, gate: (GROUND + GATE_CUT - TOOLBAR) * scale };
}

/**
 * The guest screens' header picture, drawn behind their title (white on it) and counters: the plant's main gate at the
 * horizon of a blue sky, lit by a glow rising behind it. Behind the gate, veiled, stands the headquarters: a tower with
 * the THACO sign on its crown over a curtain wall of blue glass, and a lower wing. In front, in the
 * page's grey (so the page seems to rise into the header), the gate itself, in the middle: the glass guard house in
 * the fence line and the lane beside it, under a frame with a band of glass, closed by a barrier with red bands, a no-entry sign hanging from it and its
 * signal on red, watched by two CCTV cameras; and either side, the same length, an estate fence (stone plinth, capped pillars with ball
 * finials lit at night, spear-topped railings dipping between them). A soft cloud by day; stars, lit windows and
 * finials at night. It fills its parent, whose top is the toolbar's: the drawing rises `lift` above it, and under the
 * drawing the grey goes on down to the parent's bottom.
 */
export function GuestScene() {
  const { height, lift } = useGuestScene();
  const { scheme } = useTheme();
  const c = palettes[scheme];
  const night = scheme === 'dark';

  return (
    <View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ position: 'absolute', top: -lift, left: 0, right: 0, bottom: 0 }}
    >
      {/* The sky goes on up past the screen's top, so the status bar and a pull to refresh show more of it. */}
      <View style={{ position: 'absolute', top: -SKY_ABOVE, left: 0, right: 0, height: SKY_ABOVE + 2, backgroundColor: c.sky[0] }} />
      <Svg width="100%" height={height} viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} preserveAspectRatio="xMidYMax meet">
        <Defs>
          <LinearGradient id="guestSky" gradientUnits="userSpaceOnUse" x1={0} y1={0} x2={0} y2={GROUND}>
            <Stop offset="0" stopColor={c.sky[0]} />
            <Stop offset="0.55" stopColor={c.sky[1]} />
            <Stop offset="1" stopColor={c.sky[2]} />
          </LinearGradient>
          <RadialGradient id="guestGlow" gradientUnits="userSpaceOnUse" cx={196} cy={GROUND - 10} r={190}>
            <Stop offset="0" stopColor={c.glow.color} stopOpacity={c.glow.opacity} />
            <Stop offset="1" stopColor={c.glow.color} stopOpacity={0} />
          </RadialGradient>
          <RadialGradient id="guestLamp">
            <Stop offset="0" stopColor={c.lit} stopOpacity={0.55} />
            <Stop offset="1" stopColor={c.lit} stopOpacity={0} />
          </RadialGradient>
          <RadialGradient id="guestRed">
            <Stop offset="0" stopColor={c.stripe} stopOpacity={0.6} />
            <Stop offset="1" stopColor={c.stripe} stopOpacity={0} />
          </RadialGradient>
        </Defs>

        <Rect x={-VIEW_W} y={-VIEW_H} width={VIEW_W * 3} height={VIEW_H + GROUND} fill="url(#guestSky)" />
        <Rect x={-VIEW_W} y={0} width={VIEW_W * 3} height={GROUND} fill="url(#guestGlow)" />
        {night ? (
          <Path d={STARS.map(([x, y, r]) => disc(x, y, r)).join('')} fill="#FFFFFF" fillOpacity={0.6} />
        ) : (
          <Path d={CLOUDS.map(cloud).join('')} fill="#FFFFFF" fillOpacity={c.cloud} />
        )}

        {/* The headquarters: its frame, the deeper glass (some windows lit at night), the sign on the crown. */}
        <Path d={HQ_FRAME} fill="#FFFFFF" fillOpacity={c.frame} />
        <Path d={box(WING.x, WING.y, WING.w, GROUND - WING.y)} fill="#FFFFFF" fillOpacity={c.wing} />
        <Path d={HQ_GLASS} fill={c.glass.color} fillOpacity={c.glass.opacity} />
        {night ? <Path d={HQ_LIT} fill={c.lit} fillOpacity={0.55} /> : null}
        <Rect x={SIGN.x} y={SIGN.y} width={SIGN.w} height={SIGN.h} rx={2} fill={c.sign} />
        <SvgImage
          href={images.wordmark}
          x={SIGN.x + (SIGN.w - LOGO_W) / 2}
          y={SIGN.y + (SIGN.h - LOGO_H) / 2}
          width={LOGO_W}
          height={LOGO_H}
          preserveAspectRatio="xMidYMid meet"
        />

        {/* Near plane, in the page's grey. */}
        <G fill={c.land}>
          <Rect x={-VIEW_W} y={GROUND} width={VIEW_W * 3} height={VIEW_H} />
          <Path d={FENCE_PATH + FRAME_PATH + BOOTH_PATH + BARRIER_PATH} />
        </G>
        <Path d={ARM} stroke={c.land} strokeWidth={3.2} strokeLinecap="round" />
        <Path d={ARM_STRIPES} stroke={c.stripe} strokeWidth={3.2} />

        {/* Security: the cameras and the signal, their red lights, and the no-entry sign on the arm. */}
        <Path d={CAMERAS.map(([x, y, side]) => camera(x, y, side)).join('') + CAMERA_POLE + SIGNAL_PATH} fill={c.land} />
        <Path d={SIGNAL_GREEN} fill={c.pane} />
        {night ? <Rect x={SIGNAL.x - 7} y={SIGNAL.top - 4.7} width={14} height={14} fill="url(#guestRed)" /> : null}
        <Path d={SIGNAL_RED + CAMERA_LEDS} fill={c.stripe} />
        <Path d={box(NO_ENTRY.x - 0.5, ARM_Y, 1, NO_ENTRY.y - NO_ENTRY.r - ARM_Y) + disc(NO_ENTRY.x, NO_ENTRY.y, NO_ENTRY.r)} fill={c.stripe} />
        <Path d={box(NO_ENTRY.x - 2.8, NO_ENTRY.y - 0.7, 5.6, 1.4)} fill="#FFFFFF" />

        {/* Details in the glass tone; the guard house's glass, the frame's band and the finials lit at night, with their glow. */}
        <Path d={PILLAR_PANELS} fill={c.pane} />
        <Path d={FRAME_BAND} fill={night ? c.lit : c.pane} fillOpacity={night ? 0.85 : 1} />
        <Path d={BOOTH_WINDOW} fill={night ? c.lit : c.pane} fillOpacity={night ? 0.85 : 1} />
        <Path d={BOOTH_MULLIONS} fill={c.land} />
        <Path d={FINIALS} fill={night ? c.lit : c.land} />
        {night
          ? finialPillars.map((p) => <Rect key={p} x={p + FENCE.pillarW / 2 - 7} y={FENCE.pillarTop - 12.6} width={14} height={14} fill="url(#guestLamp)" />)
          : null}
      </Svg>
      <View className="flex-1" style={{ backgroundColor: c.land }} />
    </View>
  );
}
