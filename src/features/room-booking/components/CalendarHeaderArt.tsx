import { memo } from 'react';
import { StyleSheet } from 'react-native';
import Svg, { ClipPath, Defs, G, LinearGradient, Path, RadialGradient, Rect, Stop } from 'react-native-svg';

import { useTheme } from '@/core/theme/ThemeProvider';

// The drawing is 400 × 300 with the ground on the header's bottom edge (`xMidYMax slice`).

/**
 * Day: brand blue in the sun, light rays and clouds; Sofic's pale blue glass banded floor by floor with navy slabs, a
 * glint where its right end turns to the sun. Night: a navy sky with stars, the glass dark with a few offices lit, the
 * shops, the sign and the robot's eyes glowing; close to the dark headers elsewhere. Neither sky gets lighter than
 * #1767BA, so the white toolbar, month and week stay readable.
 */
const palettes = {
  light: {
    sky: ['#003F86', '#0A57A8', '#1767BA'],
    glow: '#CFE6FF',
    glowOpacity: 0.42,
    haze: '#8CC4F5',
    hazeOpacity: 0.14,
    // Deep blue glass as in the street photo, brighter than the sky so it still stands out, deeper towards the columns.
    glass: ['#8EC0F5', '#5A95E0', '#3470C4'],
    // Form round the plan: light on the faces towards the sun, a glint on the right end, shade where it turns away.
    light: '#FFFFFF',
    lightOpacity: 0.55,
    turn: '#0A2B57',
    turnOpacity: 0.62,
    crown: '#2B6CB5',
    crownOpacity: 0.22,
    frame: '#FFFFFF',
    frameOpacity: 0.75,
    slab: ['#12315F', '#0B2248'],
    slabOpacity: 0.96,
    lip: '#D6ECFF',
    lipOpacity: 0.4,
    deepOpacity: 0.07,
    mullion: '#1D4F8A',
    mullionOpacity: 0.16,
    streakOpacity: 0.16,
    rim: '#FFFFFF',
    rimOpacity: 0.95,
    edgeLit: '#FFFFFF',
    edgeLitOpacity: 0.55,
    soffit: '#F4F8FC',
    recess: ['#0B1F3B', '#173458'],
    column: '#F4F8FC',
    columnShade: '#A9BED6',
    tree: ['#5BC08C', '#2E8A60'],
    treeBack: ['#3B9C70', '#226B4B'],
    treeLight: '#9BE3BC',
    treeLightOpacity: 0.55,
    fascia: ['#7D95B5', '#5F7899'],
    podium: ['#26466F', '#16304F'],
    podiumEdge: '#EAF4FF',
    podiumEdgeOpacity: 0.85,
    pane: '#7FB2EC',
    paneOpacity: 0.32,
    podiumMullion: '#FFFFFF',
    podiumMullionOpacity: 0.1,
    lit: '#FFD27A',
    litOpacity: 0,
    lobby: ['#4F7FB8', '#2C5A92'],
    banner: '#F2C230',
    bannerInk: '#7A5A00',
    hall: ['#8FA5C0', '#6A82A2'],
    hallStripe: '#4A6283',
    hallStripeOpacity: 0.4,
    canopy: '#F7F9FC',
    canopyShade: '#93A8C2',
    storefront: ['#1F426F', '#132C4F'],
    sign: '#E8C25A',
    signGlowOpacity: 0,
    robot: '#FFFFFF',
    robotShade: '#C3D0E0',
    visor: '#1D2838',
    eye: '#4FD1F5',
    eyeDeep: '#1E8FC0',
    emblem: '#2B6FD6',
    emblemInner: '#5EA6F2',
    eyeGlowOpacity: 0,
    scrim: '#00306A',
    scrimOpacity: 0.5,
  },
  dark: {
    sky: ['#050B16', '#091729', '#10274A'],
    glow: '#7FAEE0',
    glowOpacity: 0.16,
    haze: '#2E6FC0',
    hazeOpacity: 0.16,
    glass: ['#2A4D78', '#1A3A66', '#0F2648'],
    light: '#8CC8FF',
    lightOpacity: 0.3,
    turn: '#02070F',
    turnOpacity: 0.6,
    crown: '#4D8FD8',
    crownOpacity: 0.16,
    frame: '#8CC8FF',
    frameOpacity: 0.4,
    slab: ['#050C18', '#030811'],
    slabOpacity: 0.85,
    lip: '#8CC8FF',
    lipOpacity: 0.22,
    deepOpacity: 0.12,
    mullion: '#8CC8FF',
    mullionOpacity: 0.06,
    streakOpacity: 0.05,
    rim: '#8CC8FF',
    rimOpacity: 0.8,
    edgeLit: '#8CC8FF',
    edgeLitOpacity: 0.35,
    soffit: '#5AA2E6',
    recess: ['#030812', '#0A1A30'],
    column: '#5A86B8',
    columnShade: '#2C4E78',
    tree: ['#22605A', '#173F3C'],
    treeBack: ['#173F3C', '#10302E'],
    treeLight: '#3E8C80',
    treeLightOpacity: 0.35,
    fascia: ['#2A4466', '#1C3150'],
    podium: ['#132A48', '#091830'],
    podiumEdge: '#5AA2E6',
    podiumEdgeOpacity: 0.55,
    pane: '#3D6FAF',
    paneOpacity: 0.22,
    podiumMullion: '#8CC8FF',
    podiumMullionOpacity: 0.05,
    lit: '#FFD27A',
    litOpacity: 0.6,
    lobby: ['#D9A54E', '#8C6326'],
    banner: '#C99A1E',
    bannerInk: '#3A2A00',
    hall: ['#22395A', '#172C47'],
    hallStripe: '#0B1A2E',
    hallStripeOpacity: 0.6,
    canopy: '#33547C',
    canopyShade: '#13243C',
    storefront: ['#0E1F38', '#081428'],
    sign: '#FFD27A',
    signGlowOpacity: 0.35,
    robot: '#A7B9D0',
    robotShade: '#5E7493',
    visor: '#060C18',
    eye: '#6FE6FF',
    eyeDeep: '#1C9AD0',
    emblem: '#2B6FD6',
    emblemInner: '#6FB6FF',
    eyeGlowOpacity: 0.5,
    scrim: '#03070F',
    scrimOpacity: 0.55,
  },
};

// ---- helpers ------------------------------------------------------------------------------------
// Bottom-aligned, the header's rows land on fixed heights (iPhone 17 Pro): toolbar y ≈ 65–97 (≈ 98 on Android),
// area ≈ 163–184, month ≈ 192–217 with its chevron ending near x 206, week band ≈ 231–284 (less picture gap on short
// screens moves the upper rows down). The complex stands right of the month, the robot (from x 220) clear of the
// chevron, the tower's roof (106) below the toolbar, and the ground (229) just above the week band.

const r2 = (v: number) => Math.round(v * 100) / 100;
type Point = [number, number];
const pt = ([x, y]: Point) => `${r2(x)} ${r2(y)}`;
/** A rectangle drawn clockwise, like every shape here: overlapping shapes of one path then fill once. */
const box = (x: number, y: number, w: number, h: number) => `M${r2(x)} ${r2(y)}h${r2(w)}v${r2(h)}h${r2(-w)}Z`;
const disc = (cx: number, cy: number, r: number) => `M${r2(cx - r)} ${r2(cy)}a${r2(r)} ${r2(r)} 0 1 1 ${r2(2 * r)} 0a${r2(r)} ${r2(r)} 0 1 1 ${r2(-2 * r)} 0Z`;
const pill = (x: number, y: number, w: number, h: number) => {
  const r = h / 2;
  return `M${r2(x + r)} ${r2(y)}h${r2(w - h)}a${r2(r)} ${r2(r)} 0 0 1 0 ${r2(h)}h${r2(h - w)}a${r2(r)} ${r2(r)} 0 0 1 0 ${r2(-h)}Z`;
};
/** A polyline, or with `close` a polygon. */
const poly = (pts: Point[], close = false) => pts.map((p, i) => `${i ? 'L' : 'M'}${pt(p)}`).join('') + (close ? 'Z' : '');
/** A cloud: a pill with three puffs, `s` its scale. */
const cloud = (x: number, y: number, s: number) =>
  pill(x - 24 * s, y, 48 * s, 8 * s) + disc(x - 10 * s, y + s, 7.5 * s) + disc(x + 3 * s, y - 2 * s, 10 * s) + disc(x + 15 * s, y + 2 * s, 6.5 * s);
/** Steps from `from` while below `to`. */
const steps = (from: number, to: number, step: number) => Array.from({ length: Math.max(0, Math.ceil((to - from) / step)) }, (_, i) => from + i * step);
/** The same scatter on every render: which offices are lit, how wide a pane is. */
const hash = (a: number, b: number, seed: number) => ((a * 73856093) ^ (b * 19349663) ^ (seed * 83492791)) >>> 0;
const rad = (deg: number) => (deg * Math.PI) / 180;
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

// ---- Sofic Tower, in perspective ----------------------------------------------------------------

/** A point on the plan's outline at unit scale: its place, outward normal and arc length from the outline's start. */
type PlanPoint = { x: number; z: number; nx: number; nz: number; u: number };

/**
 * Sofic Tower (Thisofic, 10 Mai Chí Thọ, Thủ Thiêm), after the user's street-view photo, built as a solid and seen in
 * perspective so every floor bends with the form: a slab wider than deep with its corners cut off flat, so each floor
 * breaks at the facets (the right ones larger). The outline runs from the back's middle round the left end, the front
 * and the right end, back to the back's middle, so the part the camera sees is one run of it.
 */
const PLAN = { w: 1, d: 0.62, left: 0.24, right: 0.34 };
const PLAN_OUTLINE: PlanPoint[] = (() => {
  const { w, d, left: rl, right: rr } = PLAN;
  const pts: Omit<PlanPoint, 'u'>[] = [];
  /** A flat face from (x0, z0) to (x1, z1), its normal pointing out (the outline runs clockwise seen from above). */
  const face = (x0: number, z0: number, x1: number, z1: number) => {
    const l = Math.hypot(x1 - x0, z1 - z0);
    const [nx, nz] = [-(z1 - z0) / l, (x1 - x0) / l];
    pts.push({ x: x0, z: z0, nx, nz }, { x: x1, z: z1, nx, nz });
  };
  face(0, -d, -w + rl, -d);
  face(-w + rl, -d, -w, -d + rl);
  face(-w, -d + rl, -w, d - rl);
  face(-w, d - rl, -w + rl, d);
  face(-w + rl, d, w - rr, d);
  face(w - rr, d, w, d - rr);
  face(w, d - rr, w, -d + rr);
  face(w, -d + rr, w - rr, -d);
  face(w - rr, -d, 0, -d);
  let u = 0;
  return pts.map((p, i) => {
    if (i) u += Math.hypot(p.x - pts[i - 1].x, p.z - pts[i - 1].z);
    return { ...p, u };
  });
})();
const PLAN_LENGTH = PLAN_OUTLINE[PLAN_OUTLINE.length - 1].u;
/** The outline at arc length `u`. */
const planAt = (u: number): PlanPoint => {
  const i = Math.max(1, PLAN_OUTLINE.findIndex((p) => p.u >= Math.min(u, PLAN_LENGTH)));
  const [a, b] = [PLAN_OUTLINE[i - 1], PLAN_OUTLINE[i]];
  const k = b.u > a.u ? (u - a.u) / (b.u - a.u) : 0;
  return { x: lerp(a.x, b.x, k), z: lerp(a.z, b.z, k), nx: lerp(a.nx, b.nx, k), nz: lerp(a.nz, b.nz, k), u };
};
/** Where the front face starts and ends along the outline. */
const FRONT_U = (() => {
  const { w, d, left: rl, right: rr } = PLAN;
  const u0 = w - rl + 2 * Math.SQRT2 * rl + 2 * (d - rl);
  return [u0, u0 + 2 * w - rl - rr] as const;
})();

/**
 * The camera stands a little right of the front with the eye low, as in the street photo: the wide front almost
 * square on, the right facet turned to the sun, the left facets a sliver in shade. Verticals stay
 * vertical. `height` is the glass's, foot to roof, in plan units; the plan widens by `flare` at the roof.
 */
const VIEW = { yaw: rad(-8), x: 0.7, y: 0.55, z: 6.2, height: 3.2, flare: 0.08 };
const COS = Math.cos(VIEW.yaw);
const SIN = Math.sin(VIEW.yaw);
const heightAt = (t: number) => VIEW.height * (1 - t);
/** `p` turned and widened at height `y`, in the camera's frame. */
const place = (p: PlanPoint, y: number) => {
  const k = 1 + VIEW.flare * (y / VIEW.height) ** 2;
  return { X: (p.x * COS + p.z * SIN) * k, Z: (p.z * COS - p.x * SIN) * k, nx: p.nx * COS + p.nz * SIN, nz: p.nz * COS - p.nx * SIN };
};
/** How squarely `p` faces the camera at height `y`: 1 head on, 0 at the silhouette, below 0 out of sight. */
const facing = (p: PlanPoint, y: number) => {
  const q = place(p, y);
  const [dx, dz] = [VIEW.x - q.X, VIEW.z - q.Z];
  return (q.nx * dx + q.nz * dz) / Math.hypot(dx, dz);
};
const project = (p: PlanPoint, y: number): Point => {
  const q = place(p, y);
  const depth = VIEW.z - q.Z;
  return [(q.X - VIEW.x) / depth, (VIEW.y - y) / depth];
};
/** The outline's visible run at height `y`, from the left silhouette to the right one. */
const runAt = (y: number): PlanPoint[] => {
  const f = PLAN_OUTLINE.map((p) => facing(p, y));
  const first = f.findIndex((v) => v > 0);
  const last = f.length - 1 - [...f].reverse().findIndex((v) => v > 0);
  const cross = (hidden: number, seen: number) => planAt(lerp(PLAN_OUTLINE[hidden].u, PLAN_OUTLINE[seen].u, f[hidden] / (f[hidden] - f[seen])));
  return [cross(first - 1, first), ...PLAN_OUTLINE.slice(first, last + 1), cross(last + 1, last)];
};

/**
 * The tower's box in the scene: right of the month, a little lower and stouter than the photo's proportions (the
 * user's call), its roof below the toolbar so it never runs under "Đặt phòng".
 */
const TOWER_BOX = { x0: 236, x1: 334, top: 106, foot: 195 };
const FIT = (() => {
  const raw = [0, VIEW.height].flatMap((y) => runAt(y).map((p) => project(p, y)));
  const xs = raw.map(([x]) => x);
  const ys = raw.map(([, y]) => y);
  return { x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) };
})();
const toScene = ([x, y]: Point): Point => [
  lerp(TOWER_BOX.x0, TOWER_BOX.x1, (x - FIT.x0) / (FIT.x1 - FIT.x0)),
  lerp(TOWER_BOX.top, TOWER_BOX.foot, (y - FIT.y0) / (FIT.y1 - FIT.y0)),
];
/** `p` on the tower `t` of the way down, roof (0) to foot (1). */
const at = (p: PlanPoint, t: number) => toScene(project(p, heightAt(t)));
/** A floor's line across the visible faces, left silhouette to right. */
const floorLine = (t: number) => runAt(heightAt(t)).map((p) => at(p, t));
/** The band between two floor lines. */
const band = (t0: number, t1: number) => poly([...floorLine(t0), ...floorLine(t1).reverse()], true);
/** A thin line down the surface at `u` from `t0` to `t1`. */
const mullion = (u: number, t0: number, t1: number) => poly([t0, (t0 + t1) / 2, t1].map((t) => at(planAt(u), t)));
const seen = (u: number, t: number, min = 0.12) => facing(planAt(u), heightAt(t)) > min;

const ROOF_LINE = poly(floorLine(0));
const FOOT_RUN = floorLine(1);
const FOOT_LINE = poly(FOOT_RUN);
const SILHOUETTE_TS = steps(0, 1.001, 0.05);
const LEFT_EDGE = poly(SILHOUETTE_TS.map((t) => floorLine(t)[0]));
const TOWER_OUTLINE = poly(
  [...floorLine(0), ...SILHOUETTE_TS.slice(1, -1).map((t) => floorLine(t).at(-1)!), ...[...FOOT_RUN].reverse(), ...SILHOUETTE_TS.slice(1, -1).reverse().map((t) => floorLine(t)[0])],
  true,
);
const TOWER_LEFT = Math.min(...SILHOUETTE_TS.map((t) => floorLine(t)[0][0]));
const TOWER_RIGHT = Math.max(...SILHOUETTE_TS.map((t) => floorLine(t).at(-1)![0]));

/**
 * After the aerial photo: a tall gridded glass crown, then fifteen floors of pale glass down to the columns (with the
 * column floor and the podium's, the twenty storeys above ground). Each floor starts with a navy slab, a bright lip of
 * glass under it; the top floors, nearer the eye, stand a little taller, as in the photo.
 */
const CROWN = 0.105;
const FLOORS = 17;
const FLOOR_WEIGHTS = Array.from({ length: FLOORS }, (_, i) => 1 + 0.3 * Math.max(0, 1 - i / 3.5));
const WEIGHT_SUM = FLOOR_WEIGHTS.reduce((a, b) => a + b, 0);
const floorH = (i: number) => ((1 - CROWN) * FLOOR_WEIGHTS[i]) / WEIGHT_SUM;
const FLOOR_TS = FLOOR_WEIGHTS.reduce<number[]>((ts, _, i) => [...ts, i ? ts[i - 1] + floorH(i - 1) : CROWN], []);
const slabH = (i: number) => floorH(i) * 0.32;
const SLABS = FLOOR_TS.map((t, i) => band(t, t + slabH(i))).join('');
const LIPS = FLOOR_TS.map((t, i) => band(t + slabH(i), t + slabH(i) + floorH(i) * 0.06)).join('');
const DEEPS = FLOOR_TS.map((t, i) => band(t + floorH(i) * 0.7, t + floorH(i))).join('');
const CROWN_BAND = band(0, CROWN);
/** The crown's grid: a transom across it and mullions twice as close as the floors'. */
const VISIBLE_U = (() => {
  const run = runAt(heightAt(0.5));
  return [run[0].u, run[run.length - 1].u] as const;
})();
const CROWN_GRID = [
  band(CROWN * 0.48, CROWN * 0.48 + 0.0035),
  ...steps(VISIBLE_U[0], VISIBLE_U[1], 0.055)
    .filter((u) => seen(u, 0.05, 0.05))
    .map((u) => mullion(u, 0, CROWN)),
].join('');
const MULLIONS = steps(VISIBLE_U[0], VISIBLE_U[1], 0.11)
  .filter((u) => seen(u, 0.5))
  .map((u) => mullion(u, CROWN, 1))
  .join('');
/** Two soft streaks of sky light across the glass, falling from the sun's side. */
const STREAKS = [
  poly([[250, 30], [268, 30], [228, 200], [210, 200]], true),
  poly([[284, 30], [291, 30], [251, 200], [244, 200]], true),
];

/**
 * The form round the plan, sampled across the tower at mid-height: light on what faces the sun (high on the right),
 * a narrow glint where the right end turns to it, shade as the faces turn from the camera.
 */
const SUN = (() => {
  const [x, z] = [0.95, 0.31];
  const l = Math.hypot(x, z);
  return [x / l, z / l] as const;
})();
const FORM = (() => {
  const t = 0.5;
  const y = heightAt(t);
  const samples = steps(VISIBLE_U[0], VISIBLE_U[1] + 0.0001, (VISIBLE_U[1] - VISIBLE_U[0]) / 400).map((u) => {
    const p = planAt(u);
    const q = place(p, y);
    const toCam = [VIEW.x - q.X, VIEW.z - q.Z];
    const l = Math.hypot(toCam[0], toCam[1]);
    const half = [SUN[0] + toCam[0] / l, SUN[1] + toCam[1] / l];
    const hl = Math.hypot(half[0], half[1]);
    const lit = Math.max(0, q.nx * SUN[0] + q.nz * SUN[1]);
    const glint = Math.max(0, (q.nx * half[0] + q.nz * half[1]) / hl) ** 90;
    const face = Math.max(0, facing(p, y));
    return { x: at(p, t)[0], light: Math.min(1, 0.3 * lit + glint), shade: (1 - face) ** 1.6 };
  });
  // Few stops where little changes, many where the form turns quickly.
  return samples.filter((s, i) => {
    if (i === 0 || i === samples.length - 1) return true;
    const prev = samples[i - 1];
    return Math.abs(s.light - prev.light) + Math.abs(s.shade - prev.shade) > 0.04 || i % 25 === 0;
  });
})();
const formOffset = (x: number) => r2((x - TOWER_LEFT) / (TOWER_RIGHT - TOWER_LEFT));

/** The open floor of white columns under the glass, on the podium's roof. */
const PODIUM_TOP = 203;
/** Where the street level ends, just above the week band. */
const GROUND = 229;
const footY = (x: number) => {
  const i = Math.max(1, FOOT_RUN.findIndex(([fx]) => fx >= x));
  const [a, b] = [FOOT_RUN[i - 1], FOOT_RUN[Math.min(i, FOOT_RUN.length - 1)]];
  return b[0] === a[0] ? a[1] : lerp(a[1], b[1], (x - a[0]) / (b[0] - a[0]));
};
const RECESS = poly([...FOOT_RUN, [FOOT_RUN.at(-1)![0], PODIUM_TOP], [FOOT_RUN[0][0], PODIUM_TOP]], true);
/** Round white columns standing under the front and its corners, lit on the left. */
const COLUMN_XS = steps(FRONT_U[0] - 0.2, FRONT_U[1] + 0.21, (FRONT_U[1] - FRONT_U[0] + 0.4) / 6)
  .filter((u) => seen(u, 1, 0.3))
  .map((u) => at(planAt(u), 1)[0]);
const COLUMN_W = 3;
const COLUMNS = COLUMN_XS.map((x) => box(x - COLUMN_W / 2, footY(x), COLUMN_W, PODIUM_TOP - footY(x))).join('');
const COLUMN_SHADES = COLUMN_XS.map((x) => box(x + 0.2, footY(x), COLUMN_W / 2 - 0.2, PODIUM_TOP - footY(x))).join('');

/** A round tree: dark puffs behind, lighter ones in front, a highlight up-left. */
const tree = (x: number, y: number, s: number) => ({
  back: disc(x - 3.2 * s, y + 0.6 * s, 3.4 * s) + disc(x + 3.4 * s, y + 0.4 * s, 3.6 * s) + disc(x, y - 2.4 * s, 4 * s),
  front: disc(x - 1.6 * s, y + 0.2 * s, 3 * s) + disc(x + 1.8 * s, y - 1.2 * s, 3.2 * s),
  light: disc(x - 1.2 * s, y - 2.6 * s, 1.5 * s),
});
const merge = (trees: ReturnType<typeof tree>[]) => ({
  back: trees.map((t) => t.back).join(''),
  front: trees.map((t) => t.front).join(''),
  light: trees.map((t) => t.light).join(''),
});
const ROOF_TREES = merge([tree(336, 199.2, 0.8)]);

/**
 * The podium, after the photos: a long low block of dark glass with lighter panes in uneven strips under a grey
 * fascia, its left end rounded, the yellow banner near its right end. Behind it on the right a wing of glass fins,
 * Thiskyhall's grey striped block above that. It starts under the tower, leaving the month's chevron on sky.
 */
const PODIUM = { x0: 235, x1: 338, fascia: 2.8 };
const PODIUM_BODY = `M${PODIUM.x0} ${GROUND}V${PODIUM_TOP + 4}Q${PODIUM.x0} ${PODIUM_TOP} ${PODIUM.x0 + 4} ${PODIUM_TOP}H${PODIUM.x1}V${GROUND}Z`;
const FASCIA = `M${PODIUM.x0} ${PODIUM_TOP + PODIUM.fascia}V${PODIUM_TOP + 4}Q${PODIUM.x0} ${PODIUM_TOP} ${PODIUM.x0 + 4} ${PODIUM_TOP}H${PODIUM.x1}V${PODIUM_TOP + PODIUM.fascia}Z`;
const PODIUM_EDGE = box(PODIUM.x0 + 3, PODIUM_TOP, PODIUM.x1 - PODIUM.x0 - 3, 0.7);
/** Panes in uneven strips, as on the real podium. */
const PANES = (() => {
  const out: string[] = [];
  let x = PODIUM.x0 + 3;
  for (let i = 0; x < PODIUM.x1 - 2; i++) {
    const h = hash(i, 3, 5);
    const w = 1.2 + (h % 4) * 0.7;
    if (h % 3) out.push(box(x, PODIUM_TOP + PODIUM.fascia + 0.8, w, 217.8 - PODIUM_TOP - PODIUM.fascia - 0.8 - ((h >>> 4) % 3) * 1.4));
    x += w + 1.4 + ((h >>> 8) % 3) * 1.1;
  }
  return out.join('');
})();
const PODIUM_MULLIONS = steps(PODIUM.x0 + 4, PODIUM.x1, 4.2)
  .map((x) => box(x, PODIUM_TOP + PODIUM.fascia, 0.35, 218 - PODIUM_TOP - PODIUM.fascia))
  .join('');
const BANNER = { x: 319, y: PODIUM_TOP + PODIUM.fascia, w: 4.4, h: 10 };
const BANNER_INK = box(BANNER.x + 1, BANNER.y + 2.2, BANNER.w - 2, 0.6) + box(BANNER.x + 1, BANNER.y + 3.6, BANNER.w - 2, 0.6) + box(BANNER.x + 1.6, BANNER.y + 5, BANNER.w - 3.2, 0.6);
const BANNER_TAIL = `M${BANNER.x} ${BANNER.y + BANNER.h}l${BANNER.w / 2} -1.4l${BANNER.w / 2} 1.4Z`;
/** The wing runs to the drawing's right edge, so it meets the phone's edge whatever the header's height crops. */
const WING = { x0: 337.5, x1: 400, top: 206.5 };
const WING_BODY = box(WING.x0, WING.top, WING.x1 - WING.x0, GROUND - WING.top);
const WING_EDGE = box(WING.x0, WING.top, WING.x1 - WING.x0, 0.7);
const WING_FINS = steps(WING.x0 + 2, WING.x1, 2.6)
  .map((x) => box(x, WING.top + 0.7, 0.45, GROUND - WING.top - 0.7))
  .join('');
const HALL = { x0: 341, x1: 378, top: 199 };
const HALL_BODY = box(HALL.x0, HALL.top, HALL.x1 - HALL.x0, WING.top - HALL.top);
const HALL_STRIPES = steps(HALL.top + 1.8, WING.top, 2)
  .map((y) => box(HALL.x0, y, HALL.x1 - HALL.x0, 0.6))
  .join('');

/** Street level: the white canopy with the gold Thisofic sign over the lobby on the left, shops to the right. */
const STREET_TOP = 218;
const CANOPY = { x0: 233, x1: 276, y: 218.2, h: 2.2 };
const CANOPY_BODY = box(CANOPY.x0, CANOPY.y, CANOPY.x1 - CANOPY.x0, CANOPY.h);
const CANOPY_SHADE = box(CANOPY.x0 + 1, CANOPY.y + CANOPY.h, CANOPY.x1 - CANOPY.x0 - 2, 0.8);
const SIGN = { x: 245, y: CANOPY.y + 0.4, w: 15, h: 1.4 };
const LOBBY = box(PODIUM.x0, CANOPY.y + CANOPY.h, CANOPY.x1 - PODIUM.x0, GROUND - CANOPY.y - CANOPY.h);
const LOBBY_FRAMES = steps(PODIUM.x0 + 4.5, CANOPY.x1 - 1, 5.2)
  .map((x) => box(x, CANOPY.y + CANOPY.h, 0.5, GROUND - CANOPY.y - CANOPY.h))
  .join('');
const CANOPY_POSTS = box(237, CANOPY.y + CANOPY.h, 1.6, GROUND - CANOPY.y - CANOPY.h) + box(272.5, CANOPY.y + CANOPY.h, 1.6, GROUND - CANOPY.y - CANOPY.h);
const STOREFRONT = box(CANOPY.x1, STREET_TOP, PODIUM.x1 - CANOPY.x1, GROUND - STREET_TOP);
const STORE_MULLIONS = steps(CANOPY.x1 + 2.5, PODIUM.x1, 3.6)
  .map((x) => box(x, STREET_TOP + 0.6, 0.4, GROUND - STREET_TOP - 0.6))
  .join('');
const STORE_AWNING = box(CANOPY.x1, STREET_TOP, PODIUM.x1 - CANOPY.x1, 0.9);

/**
 * The white robot standing left of the canopy, in front of the podium's curved end, drawn on a 40 × 44 grid (feet at
 * 44) and scaled down: a wide head with two pointed fins and round ears, a dark visor with big cyan eyes, a round body
 * with the blue emblem, arms down. With the complex moved right it stands clear of the month's chevron.
 */
const ROBOT = { x: 220, s: 0.45 };
const ROBOT_Y = GROUND - 44 * ROBOT.s;
const ROBOT_TRANSFORM = `translate(${ROBOT.x} ${r2(ROBOT_Y)}) scale(${ROBOT.s})`;
const ROBOT_EARS = disc(2.2, 15, 3.4) + disc(37.8, 15, 3.4);
const ROBOT_FINS = 'M6 10L3.5 1L13.5 6ZM15 5.5L17 0L22 5Z';
const ROBOT_BODY = 'M10.5 25C8.5 31 9 37 12 39.5H28C31 37 31.5 31 29.5 25Z';
const ROBOT_EYES = disc(13.5, 15, 3.8) + disc(26.5, 15, 3.8);
const ROBOT_PUPILS = disc(13.5, 15.2, 2.1) + disc(26.5, 15.2, 2.1);
const ROBOT_GLINTS = disc(12.3, 13.7, 0.9) + disc(25.3, 13.7, 0.9);
const ROBOT_FEET = pill(11, 39.5, 7.5, 4.5) + pill(21.5, 39.5, 7.5, 4.5);

/** Day clouds, `[x, y, scale, opacity]`, only right of the tower: the sky over the title, area and month stays clear. */
const CLOUDS: [number, number, number, number][] = [[352, 142, 0.7, 0.16], [372, 62, 0.55, 0.12]];
const CLOUD_PATHS = CLOUDS.map(([x, y, s, opacity]) => ({ opacity, d: cloud(x, y, s) }));
/** Night stars, `[x, y, radius]`, in three brightnesses. */
const STARS: { opacity: number; points: [number, number, number][] }[] = [
  { opacity: 0.8, points: [[70, 112, 1.1], [176, 118, 1.2], [330, 66, 1], [380, 104, 1.1], [350, 150, 0.9], [128, 106, 0.9]] },
  { opacity: 0.55, points: [[18, 120, 0.9], [104, 136, 0.7], [196, 150, 0.7], [318, 132, 0.9], [366, 128, 0.8], [186, 66, 0.9], [100, 80, 0.8], [160, 70, 0.7]] },
  { opacity: 0.4, points: [[44, 150, 0.7], [152, 140, 0.8], [312, 78, 0.7], [392, 150, 0.7], [334, 166, 0.7], [60, 176, 0.7], [140, 184, 0.6], [8, 166, 0.7]] },
];
const STAR_PATHS = STARS.map(({ opacity, points }) => ({ opacity, d: points.map(([x, y, r]) => disc(x, y, r)).join('') }));
/** Day light rays fanning from the top-right corner. */
const RAYS = 'M412 20L120 176L160 200ZM412 20L40 150L64 170ZM412 20L220 236L258 246Z';

/** Offices still lit at night across the visible faces: mostly warm, a few cool. */
const LIT = (() => {
  const warm: string[] = [];
  const cool: string[] = [];
  FLOOR_TS.forEach((t, floor) => {
    steps(VISIBLE_U[0] + 0.02, VISIBLE_U[1] - 0.1, 0.12).forEach((u) => {
      const h = hash(Math.round(u * 100), floor, 13);
      if (h % 5 || !seen(u, t, 0.25)) return;
      const w = 0.07 + ((h >>> 6) % 4) * 0.025;
      const [t0, t1] = [t + slabH(floor) + floorH(floor) * 0.12, t + floorH(floor) * 0.92];
      const cellPts: Point[] = [at(planAt(u), t0), at(planAt(u + w), t0), at(planAt(u + w), t1), at(planAt(u), t1)];
      (h % 3 ? warm : cool).push(poly(cellPts, true));
    });
  });
  return { warm: warm.join(''), cool: cool.join('') };
})();
/** Night windows lower down: the podium's panes, the wing and the shops. */
const GROUND_LIT = (() => {
  const lit: string[] = [];
  steps(WING.x0 + 2.5, WING.x1 - 2, 2.6).forEach((x, i) => {
    if (hash(i, 2, 11) % 4 === 0) lit.push(box(x + 0.6, 209, 1.5, 8));
  });
  steps(CANOPY.x1 + 0.6, PODIUM.x1 - 2, 3.6).forEach((x) => lit.push(box(x + 0.5, STREET_TOP + 2, 2.6, GROUND - STREET_TOP - 3)));
  return lit.join('');
})();

/**
 * The room calendar header's picture: Sofic Tower over its podium (the Thisofic complex, where Văn phòng SOFIC is),
 * drawn after the user's photos, by day or by night with the theme, ending above the week band: the banded glass
 * tower on its white columns, the podium with its panes and the yellow banner, the wing and Thiskyhall behind
 * it, the canopy and its sign, and the white robot out front. Day adds rays and clouds; night stars, lit offices and
 * shops, the glowing roof rim, sign and robot eyes. A scrim at the top keeps the status bar readable.
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
        <LinearGradient id="rcScrim" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={c.scrim} stopOpacity={c.scrimOpacity} />
          <Stop offset="0.5" stopColor={c.scrim} stopOpacity={0} />
        </LinearGradient>
        <LinearGradient id="rcGlass" x1="0" y1={TOWER_BOX.top} x2="0" y2={TOWER_BOX.foot} gradientUnits="userSpaceOnUse">
          <Stop offset="0" stopColor={c.glass[0]} />
          <Stop offset="0.5" stopColor={c.glass[1]} />
          <Stop offset="1" stopColor={c.glass[2]} />
        </LinearGradient>
        <LinearGradient id="rcSlab" x1="0" y1={TOWER_BOX.top} x2="0" y2={TOWER_BOX.foot} gradientUnits="userSpaceOnUse">
          <Stop offset="0" stopColor={c.slab[0]} />
          <Stop offset="1" stopColor={c.slab[1]} />
        </LinearGradient>
        <LinearGradient id="rcLight" x1={TOWER_LEFT} y1="0" x2={TOWER_RIGHT} y2="0" gradientUnits="userSpaceOnUse">
          {FORM.map(({ x, light }, i) => (
            <Stop key={i} offset={formOffset(x)} stopColor={c.light} stopOpacity={r2(c.lightOpacity * light)} />
          ))}
        </LinearGradient>
        <LinearGradient id="rcShade" x1={TOWER_LEFT} y1="0" x2={TOWER_RIGHT} y2="0" gradientUnits="userSpaceOnUse">
          {FORM.map(({ x, shade }, i) => (
            <Stop key={i} offset={formOffset(x)} stopColor={c.turn} stopOpacity={r2(c.turnOpacity * shade)} />
          ))}
        </LinearGradient>
        <LinearGradient id="rcRecess" x1="0" y1={TOWER_BOX.foot} x2="0" y2={PODIUM_TOP} gradientUnits="userSpaceOnUse">
          <Stop offset="0" stopColor={c.recess[0]} />
          <Stop offset="1" stopColor={c.recess[1]} />
        </LinearGradient>
        <LinearGradient id="rcFascia" x1="0" y1={PODIUM_TOP} x2="0" y2={PODIUM_TOP + PODIUM.fascia} gradientUnits="userSpaceOnUse">
          <Stop offset="0" stopColor={c.fascia[0]} />
          <Stop offset="1" stopColor={c.fascia[1]} />
        </LinearGradient>
        <LinearGradient id="rcPodium" x1="0" y1={PODIUM_TOP} x2="0" y2={GROUND} gradientUnits="userSpaceOnUse">
          <Stop offset="0" stopColor={c.podium[0]} />
          <Stop offset="1" stopColor={c.podium[1]} />
        </LinearGradient>
        {/* The podium's form: its rounded left end turning away with a glint just inside, darkening into the wing (149 across). */}
        <LinearGradient id="rcPodiumForm" x1={PODIUM.x0} y1="0" x2={PODIUM.x0 + 149} y2="0" gradientUnits="userSpaceOnUse">
          <Stop offset="0" stopColor={c.turn} stopOpacity={c.turnOpacity * 0.7} />
          <Stop offset="0.025" stopColor={c.turn} stopOpacity={0} />
          <Stop offset="0.045" stopColor={c.light} stopOpacity={c.lightOpacity * 0.5} />
          <Stop offset="0.14" stopColor={c.light} stopOpacity={0} />
          <Stop offset="0.6" stopColor={c.light} stopOpacity={0} />
          <Stop offset="1" stopColor={c.turn} stopOpacity={c.turnOpacity * 0.45} />
        </LinearGradient>
        <LinearGradient id="rcLobby" x1="0" y1={CANOPY.y} x2="0" y2={GROUND} gradientUnits="userSpaceOnUse">
          <Stop offset="0" stopColor={c.lobby[0]} />
          <Stop offset="1" stopColor={c.lobby[1]} />
        </LinearGradient>
        <LinearGradient id="rcHall" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={c.hall[0]} />
          <Stop offset="1" stopColor={c.hall[1]} />
        </LinearGradient>
        <LinearGradient id="rcStore" x1="0" y1={STREET_TOP} x2="0" y2={GROUND} gradientUnits="userSpaceOnUse">
          <Stop offset="0" stopColor={c.storefront[0]} />
          <Stop offset="1" stopColor={c.storefront[1]} />
        </LinearGradient>
        <LinearGradient id="rcTree" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={c.tree[0]} />
          <Stop offset="1" stopColor={c.tree[1]} />
        </LinearGradient>
        <LinearGradient id="rcTreeBack" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={c.treeBack[0]} />
          <Stop offset="1" stopColor={c.treeBack[1]} />
        </LinearGradient>
        <RadialGradient id="rcSignGlow" cx={SIGN.x + SIGN.w / 2} cy={SIGN.y + SIGN.h / 2} r="14" gradientUnits="userSpaceOnUse">
          <Stop offset="0" stopColor={c.sign} stopOpacity={c.signGlowOpacity} />
          <Stop offset="1" stopColor={c.sign} stopOpacity={0} />
        </RadialGradient>
        <LinearGradient id="rcRobot" x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0" stopColor={c.robot} />
          <Stop offset="0.55" stopColor={c.robot} />
          <Stop offset="1" stopColor={c.robotShade} />
        </LinearGradient>
        <RadialGradient id="rcEyeGlow" cx="20" cy="15" r="20" gradientUnits="userSpaceOnUse">
          <Stop offset="0" stopColor={c.eye} stopOpacity={c.eyeGlowOpacity} />
          <Stop offset="1" stopColor={c.eye} stopOpacity={0} />
        </RadialGradient>
        <ClipPath id="rcTowerClip">
          <Path d={TOWER_OUTLINE} />
        </ClipPath>
        <ClipPath id="rcGroundClip">
          <Rect width={400} height={GROUND} />
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
      <Rect y={200} width={400} height={100} fill="url(#rcHaze)" />
      {/* Under the buildings: it only has to darken the sky behind the status bar. */}
      <Rect width={400} height={300} fill="url(#rcScrim)" />

      {/* Sofic Tower: the glass, the crown, light and streaks, each floor's slab and lip, then the shade as it turns away. */}
      <Path d={TOWER_OUTLINE} fill="url(#rcGlass)" />
      <G clipPath="url(#rcTowerClip)">
        <Path d={CROWN_BAND} fill={c.crown} fillOpacity={c.crownOpacity} />
        <Rect x={TOWER_LEFT} y={TOWER_BOX.top - 4} width={TOWER_RIGHT - TOWER_LEFT} height={TOWER_BOX.foot - TOWER_BOX.top + 8} fill="url(#rcLight)" />
        <Path d={DEEPS} fill={c.turn} fillOpacity={c.deepOpacity} />
        <Path d={STREAKS.join('')} fill="#FFFFFF" fillOpacity={c.streakOpacity} />
        <Path d={MULLIONS} stroke={c.mullion} strokeOpacity={c.mullionOpacity} strokeWidth={0.4} fill="none" />
        <Path d={CROWN_GRID} stroke={c.frame} strokeOpacity={c.frameOpacity} strokeWidth={0.35} fill="none" />
        <Path d={SLABS} fill="url(#rcSlab)" fillOpacity={c.slabOpacity} />
        <Path d={LIPS} fill={c.lip} fillOpacity={c.lipOpacity} />
        {night ? (
          <>
            <Path d={LIT.warm} fill="#FFD27A" fillOpacity={0.7} />
            <Path d={LIT.cool} fill="#A9D2FA" fillOpacity={0.5} />
          </>
        ) : null}
        <Rect x={TOWER_LEFT} y={TOWER_BOX.top - 4} width={TOWER_RIGHT - TOWER_LEFT} height={TOWER_BOX.foot - TOWER_BOX.top + 8} fill="url(#rcShade)" />
      </G>
      <Path d={LEFT_EDGE} stroke={c.edgeLit} strokeOpacity={c.edgeLitOpacity} strokeWidth={0.7} fill="none" />
      <Path d={ROOF_LINE} stroke={c.rim} strokeOpacity={c.rimOpacity} strokeWidth={1.1} strokeLinecap="round" fill="none" />

      {/* The floor of white columns under the glass, the slab's edge above them. */}
      <Path d={RECESS} fill="url(#rcRecess)" />
      <Path d={COLUMNS} fill={c.column} />
      <Path d={COLUMN_SHADES} fill={c.columnShade} />
      <Path d={FOOT_LINE} stroke={c.soffit} strokeWidth={1.6} strokeLinecap="round" fill="none" />

      {/* Thiskyhall behind the wing, then the tree on the podium's roof. */}
      <Path d={HALL_BODY} fill="url(#rcHall)" />
      <Path d={HALL_STRIPES} fill={c.hallStripe} fillOpacity={c.hallStripeOpacity} />
      <Path d={ROOF_TREES.back} fill="url(#rcTreeBack)" />
      <Path d={ROOF_TREES.front} fill="url(#rcTree)" />
      <Path d={ROOF_TREES.light} fill={c.treeLight} fillOpacity={c.treeLightOpacity} />

      {/* The podium: the wing of glass fins on the right, then the block with its fascia, panes and banner. */}
      <Path d={WING_BODY} fill="url(#rcPodium)" />
      <Path d={WING_FINS} fill={c.podiumMullion} fillOpacity={c.podiumMullionOpacity * 1.4} />
      <Path d={WING_EDGE} fill={c.podiumEdge} fillOpacity={c.podiumEdgeOpacity * 0.6} />
      <Path d={PODIUM_BODY} fill="url(#rcPodium)" />
      <Path d={PANES} fill={c.pane} fillOpacity={c.paneOpacity} />
      <Path d={PANES} fill={c.lit} fillOpacity={c.litOpacity * 0.5} />
      <Path d={PODIUM_MULLIONS} fill={c.podiumMullion} fillOpacity={c.podiumMullionOpacity} />
      <Path d={FASCIA} fill="url(#rcFascia)" />
      <Path d={PODIUM_EDGE} fill={c.podiumEdge} fillOpacity={c.podiumEdgeOpacity} />
      <Rect x={BANNER.x} y={BANNER.y} width={BANNER.w} height={BANNER.h} fill={c.banner} />
      <Path d={BANNER_TAIL} fill={c.podium[0]} />
      <Path d={BANNER_INK} fill={c.bannerInk} fillOpacity={0.55} />

      {/* Street level, ending above the week band: the shops and the lobby under the canopy. */}
      <G clipPath="url(#rcGroundClip)">
        <Path d={STOREFRONT} fill="url(#rcStore)" />
        <Path d={STORE_MULLIONS} fill={c.podiumMullion} fillOpacity={c.podiumMullionOpacity} />
        <Path d={STORE_AWNING} fill={c.podiumEdge} fillOpacity={c.podiumEdgeOpacity * 0.5} />
        <Path d={LOBBY} fill="url(#rcLobby)" />
        <Path d={LOBBY_FRAMES} fill={c.canopy} fillOpacity={0.35} />
        <Path d={GROUND_LIT} fill={c.lit} fillOpacity={c.litOpacity} />
        <Path d={PODIUM_BODY} fill="url(#rcPodiumForm)" />
        <Path d={CANOPY_POSTS} fill={c.canopy} />
        <Path d={CANOPY_SHADE} fill={c.canopyShade} />
        <Path d={CANOPY_BODY} fill={c.canopy} />
        <Rect x={SIGN.x - 14} y={SIGN.y - 12} width={SIGN.w + 28} height={SIGN.h + 24} fill="url(#rcSignGlow)" />
        <Rect x={SIGN.x} y={SIGN.y} width={SIGN.w} height={SIGN.h} rx={0.5} fill={c.sign} />
      </G>

      {/* The robot, white on the blue, its eyes glowing at night. */}
      <G transform={ROBOT_TRANSFORM}>
        <Rect x={-6} y={-6} width={52} height={42} fill="url(#rcEyeGlow)" />
        <Path d={`M11 28L4.5 35.5M29 28L35.5 35.5`} stroke={c.robotShade} strokeWidth={5.5} strokeLinecap="round" fill="none" />
        <Path d={`M11 28L4.5 35.5`} stroke={c.robot} strokeWidth={4} strokeLinecap="round" fill="none" />
        <Path d={ROBOT_FEET} fill={c.robotShade} />
        <Path d={ROBOT_BODY} fill="url(#rcRobot)" />
        <Path d={disc(20, 31.5, 3.3)} fill={c.emblem} />
        <Path d={disc(20, 31.5, 1.9)} fill={c.emblemInner} />
        <Path d={ROBOT_EARS} fill={c.robotShade} />
        <Path d={ROBOT_FINS} fill={c.robot} />
        <Rect x={1} y={4} width={38} height={21.5} rx={10.5} fill="url(#rcRobot)" />
        <Rect x={5} y={8.5} width={30} height={13} rx={6.5} fill={c.visor} />
        <Path d={ROBOT_EYES} fill={c.eye} />
        <Path d={ROBOT_PUPILS} fill={c.eyeDeep} />
        <Path d={ROBOT_GLINTS} fill="#FFFFFF" />
      </G>
    </Svg>
  );
});
