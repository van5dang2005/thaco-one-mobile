import { useWindowDimensions, View } from 'react-native';
import Svg, { Circle, Defs, G, Path, Pattern, RadialGradient, Rect, Stop } from 'react-native-svg';

import { useTheme } from '@/core/theme/ThemeProvider';

/** Drawing box of the scene. It is drawn the screen's width wide (scaled as for at most `MAX_WIDTH`), keeping the ratio. */
const VIEW_W = 390;
const VIEW_H = 300;
const MAX_WIDTH = 430;
/** Where the buildings stand. */
const GROUND = 192;
/** Level with the top of the screen's toolbar: the tower's roof and beacon rise beside and above it. */
const TOOLBAR = 24;

/** Day: brand-blue buildings in the sun, clouds, birds. Night: the same buildings dark with lit windows, moon and stars. */
const palettes = {
  light: {
    skyline: '#BED1E8',
    skylineNear: '#A9C2E0',
    block: '#8FB1D9',
    blockShade: '#7A9FCC',
    ribbon: '#EAF2FB',
    ribbonLit: '#EAF2FB',
    tower: '#2D6FB8',
    towerSide: '#1E5492',
    towerRoof: '#1A4A82',
    towerAccent: '#5BA3EA',
    window: '#C4DBF3',
    windowOpacity: 0.42,
    windowLit: '#FFFFFF',
    windowLitOpacity: 0.75,
    streakOpacity: 0.16,
    podium: '#EEF4FA',
    podiumRoof: '#C2D4E9',
    glass: '#3A78BE',
    glassOpacity: 1,
    canopy: '#00539B',
    booth: '#F7FAFD',
    boothRoof: '#00539B',
    boothWindow: '#9CC6EE',
    barrierPost: '#3A4A5E',
    barrierRed: '#D8453A',
    barrierWhite: '#FFFFFF',
    tree: '#5BB894',
    treeShade: '#43A07E',
    trunk: '#7D6A55',
    ground: '#C9D9EC',
    groundLine: '#FFFFFF',
    road: '#A9BFD8',
    lane: '#FFFFFF',
    laneOpacity: 0.85,
    curb: '#E4ECF6',
    lawn: '#CDE7D9',
    bush: '#7CC4A3',
    car: '#E0574C',
    carWindow: '#D7E9F8',
    wheel: '#2A3646',
    headlight: '#FFF1C9',
    light: '#FFF1C9',
    cloud: '#FFFFFF',
    bird: '#3A4A5E',
    beacon: '#E0574C',
    flagPole: '#8A97A8',
  },
  dark: {
    skyline: '#172A43',
    skylineNear: '#1B3150',
    block: '#203D63',
    blockShade: '#1A3354',
    ribbon: '#2B4C76',
    ribbonLit: '#FFD27A',
    tower: '#1C426F',
    towerSide: '#13304F',
    towerRoof: '#102844',
    towerAccent: '#2A6DC4',
    window: '#3E679A',
    windowOpacity: 0.5,
    windowLit: '#FFD27A',
    windowLitOpacity: 0.9,
    streakOpacity: 0.05,
    podium: '#1B3352',
    podiumRoof: '#244369',
    glass: '#F2C46E',
    glassOpacity: 0.85,
    canopy: '#2A6DC4',
    booth: '#1E3858',
    boothRoof: '#2A6DC4',
    boothWindow: '#FFD27A',
    barrierPost: '#9FB0C4',
    barrierRed: '#E2574C',
    barrierWhite: '#DCE3EB',
    tree: '#1F5550',
    treeShade: '#17443F',
    trunk: '#3A3026',
    ground: '#0E1A2A',
    groundLine: '#2A4466',
    road: '#0A1422',
    lane: '#FFFFFF',
    laneOpacity: 0.25,
    curb: '#1A2C44',
    lawn: '#0F2A27',
    bush: '#1A4A44',
    car: '#2A6DC4',
    carWindow: '#5D7FA8',
    wheel: '#05090F',
    headlight: '#FFD27A',
    light: '#EAF1FA',
    cloud: '#FFFFFF',
    bird: '#FFFFFF',
    beacon: '#FF6B5E',
    flagPole: '#5B6B80',
  },
};

/** Distant towers, `[x, top, width]`, repeated left and right so wide screens stay filled. */
const skyline = [
  [0, 148, 22], [20, 130, 18], [36, 154, 26], [60, 138, 16], [74, 160, 28], [100, 142, 20], [118, 124, 14], [130, 150, 26],
  [154, 136, 18], [170, 156, 22], [190, 146, 16], [204, 164, 20], [222, 116, 22], [242, 140, 16], [256, 128, 14], [338, 122, 18],
  [354, 146, 22], [374, 134, 18],
];
const skylineNear = [[90, 146, 34], [136, 158, 36], [336, 142, 20]];

/** Tower windows lit at night (and catching the sun by day), `[column, row]` on its 10 × 12 grid. */
const litWindows = Array.from({ length: 6 * 12 }, (_, i) => [28 + (i % 6), 3 + Math.floor(i / 6)]).filter(([col, row]) => (col * 7 + row * 5) % 4 === 0);
/** Lit stretches of the side blocks' window ribbons at night, `[x, y]`, 14 wide. */
const litRibbons = [[27, 121], [57, 135], [42, 149], [72, 149], [27, 163], [57, 177], [365, 131], [395, 145], [380, 173]];

const stars = [[22, 90, 0.9], [60, 70, 0.8], [98, 96, 0.8], [120, 62, 1], [146, 92, 0.8], [160, 116, 0.7], [178, 58, 1.1], [204, 84, 0.8], [236, 66, 1], [250, 100, 0.7], [356, 86, 0.8], [380, 100, 1]];
const trees = [
  { x: 8, r: 15 },
  { x: 158, r: 11 },
  { x: 366, r: 13 },
];

/** The scene at the current screen width: the drawing's height and how far it rises above the toolbar's top (`lift`). */
export function useGuestScene() {
  const { width } = useWindowDimensions();
  const scale = Math.min(width, MAX_WIDTH) / VIEW_W;
  return { height: VIEW_H * scale, lift: TOOLBAR * scale };
}

/**
 * The guest dashboard's background picture, drawn behind its title and counters: an office tower and its lobby, the
 * guard booth and barrier at the gate, trees, a distant skyline, and the road with a car and a lawn in front. By day
 * under the sun with clouds; at night with lit windows, the moon and stars. It fills its parent, whose top is the
 * toolbar's: the drawing rises `lift` above it, and under the drawing the lawn goes on down to the parent's bottom.
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
      <Svg width="100%" height={height} viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} preserveAspectRatio="xMidYMax meet">
        <Defs>
          <RadialGradient id="sceneLight">
            <Stop offset="0" stopColor={c.light} stopOpacity={night ? 0.35 : 0.9} />
            <Stop offset="1" stopColor={c.light} stopOpacity={0} />
          </RadialGradient>
          <Pattern id="sceneLane" width={30} height={2} patternUnits="userSpaceOnUse">
            <Rect width={16} height={2} rx={1} fill={c.lane} fillOpacity={c.laneOpacity} />
          </Pattern>
          <Pattern id="sceneWindows" width={10} height={12} patternUnits="userSpaceOnUse">
            <Rect x={2} y={3} width={6} height={7} rx={0.8} fill={c.window} fillOpacity={c.windowOpacity} />
          </Pattern>
        </Defs>

        {/* Sky: sun and clouds by day, moon and stars at night. */}
        <Circle cx={374} cy={58} r={34} fill="url(#sceneLight)" />
        <Circle cx={374} cy={58} r={night ? 8 : 10} fill={c.light} />
        {night ? (
          stars.map(([x, y, r]) => <Circle key={`${x}-${y}`} cx={x} cy={y} r={r} fill="#FFFFFF" fillOpacity={0.7} />)
        ) : (
          <>
            <Cloud x={52} y={80} size={0.7} color={c.cloud} />
            <Cloud x={150} y={86} size={1} color={c.cloud} />
            <Cloud x={226} y={106} size={0.75} color={c.cloud} />
            <G stroke={c.bird} strokeOpacity={0.35} strokeWidth={1.2} strokeLinecap="round" fill="none">
              <Path d="M214 84 q3 -3 6 0 q3 -3 6 0" />
              <Path d="M232 76 q2.4 -2.4 4.8 0 q2.4 -2.4 4.8 0" />
            </G>
          </>
        )}

        {/* Skyline in the distance, then a nearer row of blocks. */}
        {[-VIEW_W, 0, VIEW_W].map((dx) => (
          <G key={dx} transform={`translate(${dx} 0)`} fill={c.skyline}>
            {skyline.map(([x, y, w]) => (
              <Rect key={x} x={x} y={y} width={w} height={GROUND - y} />
            ))}
          </G>
        ))}
        <G fill={c.skylineNear}>
          {skylineNear.map(([x, y, w]) => (
            <Rect key={x} x={x} y={y} width={w} height={GROUND - y} />
          ))}
        </G>

        {/* Side blocks with ribbon windows, left and right. */}
        <Rect x={22} y={112} width={70} height={GROUND - 112} fill={c.block} />
        <Rect x={34} y={104} width={26} height={8} fill={c.blockShade} />
        <Rect x={66} y={106} width={10} height={6} fill={c.blockShade} />
        <Rect x={360} y={108} width={60} height={GROUND - 108} fill={c.block} />
        <Rect x={368} y={100} width={22} height={8} fill={c.blockShade} />
        {[121, 135, 149, 163, 177].map((y) => (
          <G key={y} fill={c.ribbon}>
            <Rect x={27} y={y} width={60} height={7} rx={1} />
            <Rect x={365} y={y} width={60} height={7} rx={1} />
          </G>
        ))}
        {night ? litRibbons.map(([x, y]) => <Rect key={`${x}-${y}`} x={x} y={y} width={14} height={7} rx={1} fill={c.ribbonLit} fillOpacity={0.8} />) : null}

        {/* The tower: front with its window grid, a lit accent edge, the shaded side, roof and beacon. */}
        <Rect x={274} y={22} width={68} height={GROUND - 22} fill={c.tower} />
        <Path d={`M342 22 L356 29 L356 ${GROUND} L342 ${GROUND} Z`} fill={c.towerSide} />
        <Rect x={280} y={30} width={60} height={150} fill="url(#sceneWindows)" />
        {litWindows.map(([col, row]) => (
          <Rect key={`${col}-${row}`} x={col * 10 + 2} y={row * 12 + 3} width={6} height={7} rx={0.8} fill={c.windowLit} fillOpacity={c.windowLitOpacity} />
        ))}
        <Path d="M294 22 L310 22 L280 130 L274 130 L274 92 Z" fill="#FFFFFF" fillOpacity={c.streakOpacity} />
        <Rect x={274} y={22} width={4} height={GROUND - 22} fill={c.towerAccent} />
        <Rect x={271} y={17} width={72} height={5} rx={1} fill={c.towerRoof} />
        <Path d="M343 17 L357 24 L357 29 L343 22 Z" fill={c.towerRoof} />
        <Rect x={326} y={5} width={2} height={12} fill={c.towerRoof} />
        <Circle cx={327} cy={4.5} r={1.8} fill={c.beacon} />

        {/* The lobby wing: glass band, entrance canopy and doors. */}
        <Rect x={176} y={132} width={98} height={GROUND - 132} fill={c.podium} />
        <Rect x={173} y={128} width={104} height={5} rx={1} fill={c.podiumRoof} />
        <Rect x={182} y={140} width={86} height={15} fill={c.glass} fillOpacity={c.glassOpacity} />
        {[196, 210, 224, 239, 253].map((x) => (
          <Rect key={x} x={x} y={140} width={1.2} height={15} fill={c.podium} />
        ))}
        <Rect x={210} y={163} width={40} height={GROUND - 163} fill={c.glass} fillOpacity={c.glassOpacity} />
        <Rect x={229.4} y={163} width={1.2} height={GROUND - 163} fill={c.podium} />
        <Rect x={204} y={159} width={52} height={4} rx={1} fill={c.canopy} />

        {/* Trees, behind the barrier. */}
        {trees.map(({ x, r }) => (
          <G key={x}>
            <Rect x={x - 1.5} y={GROUND - 16} width={3} height={16} fill={c.trunk} />
            <Circle cx={x} cy={GROUND - r - 10} r={r} fill={c.tree} />
            <Circle cx={x + r * 0.55} cy={GROUND - r * 0.7 - 8} r={r * 0.72} fill={c.treeShade} />
          </G>
        ))}

        {/* The gate: a flag, the guard booth with a lit window and the striped barrier arm. */}
        <Rect x={98.5} y={124} width={1.5} height={GROUND - 124} fill={c.flagPole} />
        <Path d="M100 125 q7 -2.5 14 0 v9 q-7 -2.5 -14 0 Z" fill={c.canopy} />
        <Rect x={108} y={160} width={26} height={GROUND - 160} fill={c.booth} />
        <Rect x={104} y={154} width={34} height={6} rx={1.5} fill={c.boothRoof} />
        <Rect x={112} y={166} width={18} height={11} rx={1} fill={c.boothWindow} />
        <Rect x={137} y={166} width={5} height={GROUND - 166} rx={1} fill={c.barrierPost} />
        <Rect x={142} y={167} width={52} height={4} rx={2} fill={c.barrierWhite} />
        {[142, 158, 174].map((x) => (
          <Rect key={x} x={x} y={167} width={8} height={4} fill={c.barrierRed} />
        ))}
        <Circle cx={139.5} cy={169} r={3.5} fill={c.barrierPost} />

        {/* In front: the pavement, the road with its lane marks and a car, the kerb and a lawn with bushes at the sides. */}
        <Rect x={-VIEW_W} y={GROUND} width={VIEW_W * 3} height={10} fill={c.ground} />
        <Rect x={-VIEW_W} y={GROUND} width={VIEW_W * 3} height={1.5} fill={c.groundLine} fillOpacity={0.7} />
        <Rect x={-VIEW_W} y={202} width={VIEW_W * 3} height={38} fill={c.road} />
        <Rect x={-VIEW_W} y={220} width={VIEW_W * 3} height={2} fill="url(#sceneLane)" />
        <Rect x={-VIEW_W} y={240} width={VIEW_W * 3} height={4} fill={c.curb} />
        <Rect x={-VIEW_W} y={244} width={VIEW_W * 3} height={VIEW_H - 244} fill={c.lawn} />
        {[6, 26, 364, 384].map((x) => (
          <Circle key={x} cx={x} cy={258} r={9} fill={c.bush} />
        ))}
        <Path d="M58 223 L64 214 L80 214 L86 223 Z" fill={c.car} />
        <Path d="M61.5 222 L65.5 216.5 L78.5 216.5 L82.5 222 Z" fill={c.carWindow} />
        <Rect x={48} y={222} width={44} height={12} rx={4} fill={c.car} />
        <Rect x={89} y={225} width={3} height={3} rx={1} fill={c.headlight} />
        <Circle cx={58} cy={234} r={4} fill={c.wheel} />
        <Circle cx={82} cy={234} r={4} fill={c.wheel} />
      </Svg>
      <View className="flex-1" style={{ backgroundColor: c.lawn }} />
    </View>
  );
}

/** A soft cloud: a flat base under three puffs, `size` 1 ≈ 46 wide. */
function Cloud({ x, y, size, color }: { x: number; y: number; size: number; color: string }) {
  return (
    <G opacity={0.85} fill={color}>
      <Rect x={x - 22 * size} y={y} width={44 * size} height={9 * size} rx={4.5 * size} />
      <Circle cx={x - 10 * size} cy={y + size} r={8 * size} />
      <Circle cx={x + 4 * size} cy={y - 2 * size} r={11 * size} />
      <Circle cx={x + 15 * size} cy={y + 2 * size} r={7 * size} />
    </G>
  );
}
