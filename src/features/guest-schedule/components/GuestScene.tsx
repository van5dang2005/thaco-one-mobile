import { useWindowDimensions, View } from 'react-native';
import Svg, { Circle, Defs, Ellipse, G, Image as SvgImage, LinearGradient, Mask, Path, Pattern, RadialGradient, Rect, Stop } from 'react-native-svg';

import { useTheme } from '@/core/theme/ThemeProvider';
import { images, WORDMARK_RATIO } from '@/shared/assets';

/** Drawing box of the scene. It is drawn the screen's width wide (scaled as for at most `MAX_WIDTH`), keeping the ratio. */
const VIEW_W = 390;
const VIEW_H = 300;
const MAX_WIDTH = 430;
/** Where the sky's gradient ends, behind the buildings. */
const HORIZON = 150;
/** Where the buildings stand. */
const GROUND = 190;
/** How far the sky goes on above the drawing (it tucks 2pt under the drawing's top, so no seam shows between them). */
const SKY_ABOVE = 1200;
/** Level with the top of the screen's toolbar: the crane and the sun rise beside and above it. */
const TOOLBAR = 24;

/** Day: white halls and the blue THACO sign in the sun. Night: the same plant dark with lit windows and a lit sign. */
const palettes = {
  light: {
    sky: ['#A9CDF0', '#E4EFFA'],
    ridge: '#C6D7EB',
    box: '#D8453A',
    crane: '#8FB1D9',
    craneDark: '#7A9FCC',
    beacon: '#E0574C',
    backBlock: '#DCE6F2',
    backRibbon: '#C2D5EB',
    stack: '#EEF3F9',
    stackBand: '#00539B',
    wall: '#F5F8FC',
    wallShade: '#E2EAF4',
    saw: '#C7D6E8',
    sawGlass: '#6E9AD0',
    vault: '#4A86C8',
    vaultShade: '#3A73B4',
    band: '#00539B',
    ribbon: '#BCD4EE',
    door: '#C9D5E3',
    doorLine: '#AEBED2',
    fascia: '#00539B',
    fasciaCap: '#003F78',
    signGlow: 0,
    glass: '#3A78BE',
    glassOpacity: 1,
    windowLit: '#FFFFFF',
    windowLitOpacity: 0.55,
    canopy: '#003F78',
    flagPole: '#8A97A8',
    booth: '#2D6FB8',
    boothShade: '#245C9A',
    boothRoof: '#003F78',
    boothWindow: '#D3E7FA',
    barrierPost: '#3A4A5E',
    barrierRed: '#D8453A',
    barrierWhite: '#FFFFFF',
    lamp: '#3DBE7A',
    fence: '#5E6E82',
    fenceBase: '#C9D3DF',
    pillar: '#EEF3F9',
    pillarShade: '#D3DEEA',
    pillarCap: '#00539B',
    pillarLamp: '#FFF1C9',
    road: '#BCCBDD',
    roadLine: '#FFFFFF',
    bus: '#E0574C',
    busShade: '#B9433A',
    busGlass: '#2F4A6B',
    tailAmber: '#FFB347',
    tailRed: '#FF5A4E',
    plate: '#F5F5F0',
    shadow: 0.14,
    tree: '#5BB894',
    treeShade: '#43A07E',
    trunk: '#7D6A55',
    lawn: '#CDE7D9',
    yard: '#D5E1EF',
    cars: ['#FFFFFF', '#C3CCD7', '#D8453A', '#2D6FB8', '#3A4A5E', '#FFFFFF', '#9AA7B6'],
    carGlass: '#8FB4DA',
    wheel: '#2A3646',
    light: '#FFD66B',
    sun: '#FFC23D',
    sunCore: '#FFE08A',
    cloud: '#FFFFFF',
    bird: '#3A4A5E',
  },
  dark: {
    sky: ['#081426', '#1A3354'],
    ridge: '#13253C',
    box: '#7A3A36',
    crane: '#2B4A72',
    craneDark: '#223C5E',
    beacon: '#FF6B5E',
    backBlock: '#152A45',
    backRibbon: '#C9A55E',
    stack: '#1E3858',
    stackBand: '#2A6DC4',
    wall: '#1B3352',
    wallShade: '#162B46',
    saw: '#244369',
    sawGlass: '#FFD27A',
    vault: '#1C426F',
    vaultShade: '#163659',
    band: '#2A6DC4',
    ribbon: '#FFD27A',
    door: '#22395A',
    doorLine: '#2D4A70',
    fascia: '#0A5AA6',
    fasciaCap: '#083F78',
    signGlow: 0.35,
    glass: '#F2C46E',
    glassOpacity: 0.85,
    windowLit: '#FFD27A',
    windowLitOpacity: 0.9,
    canopy: '#2A6DC4',
    flagPole: '#5B6B80',
    booth: '#1C426F',
    boothShade: '#163659',
    boothRoof: '#2A6DC4',
    boothWindow: '#FFD27A',
    barrierPost: '#9FB0C4',
    barrierRed: '#E2574C',
    barrierWhite: '#DCE3EB',
    lamp: '#5FE39A',
    fence: '#7F93AC',
    fenceBase: '#22395A',
    pillar: '#284A72',
    pillarShade: '#1E3A5C',
    pillarCap: '#2A6DC4',
    pillarLamp: '#FFD27A',
    road: '#0A1422',
    roadLine: '#5D7FA8',
    bus: '#C9483E',
    busShade: '#9E3A32',
    busGlass: '#FFD27A',
    tailAmber: '#FFC266',
    tailRed: '#FF6B5E',
    plate: '#DCE3EB',
    shadow: 0.3,
    tree: '#1F5550',
    treeShade: '#17443F',
    trunk: '#3A3026',
    lawn: '#0F2A27',
    yard: '#0E1A2A',
    cars: ['#9FB0C4', '#5B6B80', '#B5463E', '#2A6DC4', '#1A2533', '#9FB0C4', '#3E4D60'],
    carGlass: '#2B4A72',
    wheel: '#05090F',
    light: '#EAF1FA',
    sun: '#F4EBC4',
    sunCore: '#F4EBC4',
    cloud: '#FFFFFF',
    bird: '#FFFFFF',
  },
};

type ScenePalette = (typeof palettes)[keyof typeof palettes];

/** The left hall's sawtooth roof: teeth `SAW_W` wide, `SAW_H` tall, standing on `SAW_BASE`. */
const SAW_X = -4;
const SAW_W = 16;
const SAW_H = 9;
const SAW_BASE = 152;
const sawTeeth = Array.from({ length: 8 }, (_, i) => SAW_X + i * SAW_W);

/** The main block, its sign along the top with the THACO wordmark in the middle, and its three-storey curtain wall. */
const FASCIA = { x: 108, y: 74, w: 178, h: 32 };
const LOGO_H = 18;
const LOGO_W = LOGO_H * WORDMARK_RATIO;
const CURTAIN = { x: 120, y: 112, cols: 11, rows: 3, pane: 14, row: 16 };
/** Curtain-wall panes lit at night (and catching the sun by day), `[column, row]`. */
const litPanes = [[0, 0], [3, 0], [4, 1], [7, 0], [8, 2], [10, 1], [1, 2], [5, 2]];

/** The gate's two pillars, either side of the lane, and the fence running off from them along the front. */
const PILLARS = [88, 167];
const PILLAR_W = 9;
const FENCE_TOP = 176;
/** The barrier's post just inside the left pillar; the arm pivots on it and stands almost upright. */
const BARRIER = { x: 99, pivot: { x: 101.5, y: 170 }, angle: -84, length: 60 };

/** The way in: the lane between the gate's pillars at the ground, widening towards the viewer. */
const LANE = { left: 98, right: 166 };
const ROAD_FOOT = { left: 40, right: 224 };
/** The road's edges at height `y`, below the ground line. */
function roadAt(y: number) {
  const t = (y - GROUND) / (VIEW_H - GROUND);
  return { left: LANE.left + (ROAD_FOOT.left - LANE.left) * t, right: LANE.right + (ROAD_FOOT.right - LANE.right) * t };
}

/** The sun by day (a disc with ten rays) and the crescent moon at night, in the top-right corner. */
const SUN = { x: 370, y: 36 };
const sunRays = Array.from({ length: 10 }, (_, i) => {
  const a = (i / 10) * Math.PI * 2;
  return [SUN.x + Math.cos(a) * 14, SUN.y + Math.sin(a) * 14, SUN.x + Math.cos(a) * 18.5, SUN.y + Math.sin(a) * 18.5];
});

const stars = [[20, 112, 0.9], [22, 86, 0.9], [60, 72, 0.8], [98, 96, 0.8], [124, 62, 1], [300, 96, 0.8], [356, 96, 0.8]];
const trees = [
  { x: 288, r: 8 },
  { x: 386, r: 10 },
];
/** Finished cars parked in rows on the yard either side of the road, `[row y, first x]`; mostly hidden by the counters. */
const carRows = [[208, 6], [232, 16], [256, 2]];
const parkedCars = carRows.flatMap(([y, x0], row) =>
  Array.from({ length: 17 }, (_, i) => ({ x: x0 + i * 23, y, color: (i + row * 3) % 7 })).filter(({ x }) => {
    const road = roadAt(y + 9);
    return x + 18 < road.left - 3 || x > road.right + 3;
  }),
);

/** How far below the ground line a header that stops under the gate cuts the picture: past the coach and its shadow. */
const GATE_CUT = 12;

/**
 * The scene at the current screen width: the drawing's height, how far it rises above the toolbar's top (`lift`), and
 * how far below the toolbar's top a header cut just under the gate ends (`gate`), for screens without the counters.
 */
export function useGuestScene() {
  const { width } = useWindowDimensions();
  const scale = Math.min(width, MAX_WIDTH) / VIEW_W;
  return { height: VIEW_H * scale, lift: TOOLBAR * scale, gate: (GROUND + GATE_CUT - TOOLBAR) * scale };
}

/**
 * The guest dashboard's header picture, drawn behind its title and counters: the THACO Chu Lai plant under its own sky,
 * which runs on up past the top of the screen. The tall main block carries a large THACO sign over three storeys of
 * glass, between a sawtooth assembly hall and a vaulted hall, with taller shop blocks and two stacks behind them and a
 * port crane at the back. In front run the fence and the gate: two pillars with lamps, the sliding leaf rolled open, the
 * guard booth with its signal on green and the barrier arm raised, and a guests' 50-seat coach, seen from behind,
 * driving up the road through it. Trees and rows of finished cars stand
 * on the yard either side of the road. By day under the sun with clouds and gulls; at night with lit windows, a lit
 * sign, the crescent moon and stars. It fills its parent, whose top is the toolbar's: the drawing rises `lift` above it,
 * and under the drawing the yard goes on down to the parent's bottom.
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
          <LinearGradient id="sceneSky" gradientUnits="userSpaceOnUse" x1={0} y1={0} x2={0} y2={HORIZON}>
            <Stop offset="0" stopColor={c.sky[0]} />
            <Stop offset="1" stopColor={c.sky[1]} />
          </LinearGradient>
          <RadialGradient id="sceneLight">
            <Stop offset="0" stopColor={c.light} stopOpacity={night ? 0.35 : 0.9} />
            <Stop offset="1" stopColor={c.light} stopOpacity={0} />
          </RadialGradient>
          <Mask id="moonCut">
            <Rect x={330} y={0} width={60} height={70} fill="#FFFFFF" />
            <Circle cx={SUN.x + 4.5} cy={SUN.y - 3.5} r={8} fill="#000000" />
          </Mask>
          <Pattern id="fenceBars" width={3.5} height={10} patternUnits="userSpaceOnUse">
            <Rect width={0.9} height={10} fill={c.fence} />
          </Pattern>
          <Pattern id="gateBars" width={2.4} height={14} patternUnits="userSpaceOnUse">
            <Rect width={0.8} height={14} fill={c.fence} />
          </Pattern>
          <RadialGradient id="pillarGlow">
            <Stop offset="0" stopColor={c.pillarLamp} stopOpacity={night ? 0.6 : 0} />
            <Stop offset="1" stopColor={c.pillarLamp} stopOpacity={0} />
          </RadialGradient>
          <RadialGradient id="signGlow">
            <Stop offset="0" stopColor="#5AA2E6" stopOpacity={c.signGlow} />
            <Stop offset="1" stopColor="#5AA2E6" stopOpacity={0} />
          </RadialGradient>
        </Defs>

        {/* Sky: sun, clouds and gulls by day, moon and stars at night. */}
        <Rect x={-VIEW_W} y={-VIEW_H} width={VIEW_W * 3} height={VIEW_H + GROUND} fill="url(#sceneSky)" />
        <Circle cx={SUN.x} cy={SUN.y} r={night ? 26 : 32} fill="url(#sceneLight)" />
        {night ? (
          <Circle cx={SUN.x} cy={SUN.y} r={10} fill={c.sun} mask="url(#moonCut)" />
        ) : (
          <>
            <G stroke={c.sun} strokeWidth={2} strokeLinecap="round">
              {sunRays.map(([x1, y1, x2, y2]) => (
                <Path key={`${x1}-${y1}`} d={`M${x1} ${y1} L${x2} ${y2}`} />
              ))}
            </G>
            <Circle cx={SUN.x} cy={SUN.y} r={10} fill={c.sun} />
            <Circle cx={SUN.x - 2} cy={SUN.y - 2} r={6} fill={c.sunCore} />
          </>
        )}
        {night ? (
          stars.map(([x, y, r]) => <Circle key={`${x}-${y}`} cx={x} cy={y} r={r} fill="#FFFFFF" fillOpacity={0.7} />)
        ) : (
          <>
            <Cloud x={30} y={100} size={0.65} color={c.cloud} />
            <Cloud x={264} y={58} size={0.55} color={c.cloud} />
            <G stroke={c.bird} strokeOpacity={0.35} strokeWidth={1.2} strokeLinecap="round" fill="none">
              <Path d="M42 116 q3 -3 6 0 q3 -3 6 0" />
              <Path d="M58 108 q2.4 -2.4 4.8 0 q2.4 -2.4 4.8 0" />
            </G>
          </>
        )}

        {/* The hills of Núi Thành behind the plant. */}
        <Path d="M-10 150 L14 132 L34 138 L66 116 L100 134 L128 124 L170 150 Z" fill={c.ridge} />

        {/* The port crane at the back: legs, portal beam, A-frame, the boom with its stays, trolley and box. */}
        <G fill={c.crane}>
          <Rect x={318} y={74} width={3} height={76} />
          <Rect x={342} y={74} width={3} height={76} />
          <Rect x={318} y={88} width={27} height={3} />
          <Rect x={282} y={72} width={102} height={4} />
          <Rect x={300} y={76} width={9} height={5} fill={c.craneDark} />
          <Rect x={304} y={81} width={0.8} height={8} />
          <Rect x={299} y={89} width={11} height={6} fill={c.box} />
        </G>
        <G stroke={c.crane} strokeWidth={1.4} fill="none">
          <Path d="M319.5 74 L331.5 50 L343.5 74" />
          <Path d="M331.5 50 L286 72 M331.5 50 L380 72" strokeWidth={0.8} />
        </G>
        <Circle cx={331.5} cy={49} r={1.8} fill={c.beacon} />

        {/* Taller shop blocks behind the halls, with ribbon windows, and two stacks on the left one. */}
        {[70, 84].map((x) => (
          <G key={x}>
            <Rect x={x} y={88} width={7} height={36} fill={c.stack} />
            <Rect x={x} y={88} width={7} height={4} fill={c.stackBand} />
            {night ? <Circle cx={x + 3.5} cy={86.6} r={1.2} fill={c.beacon} /> : null}
          </G>
        ))}
        <Rect x={-4} y={124} width={116} height={GROUND - 124} fill={c.backBlock} />
        <Rect x={280} y={100} width={116} height={GROUND - 100} fill={c.backBlock} />
        <G fill={c.backRibbon}>
          {[130, 137].map((y) => (
            <Rect key={y} x={2} y={y} width={104} height={3} />
          ))}
          {[107, 114, 121].map((y) => (
            <Rect key={y} x={290} y={y} width={100} height={3} />
          ))}
        </G>

        {/* Left: the sawtooth assembly hall, glazed north lights, a blue band, ribbon windows and roller doors. */}
        <Path
          d={`M${SAW_X} ${SAW_BASE} ${sawTeeth.map((x) => `L${x} ${SAW_BASE - SAW_H} L${x + SAW_W} ${SAW_BASE}`).join(' ')} Z`}
          fill={c.saw}
        />
        {sawTeeth.map((x) => (
          <Rect key={x} x={x} y={SAW_BASE - SAW_H} width={1.6} height={SAW_H} fill={c.sawGlass} />
        ))}
        <Rect x={SAW_X} y={SAW_BASE} width={128} height={GROUND - SAW_BASE} fill={c.wall} />
        <Rect x={SAW_X} y={SAW_BASE + 3} width={128} height={3} fill={c.band} />
        <Rect x={2} y={SAW_BASE + 9} width={104} height={4} fill={c.ribbon} />
        {[0, 20].map((x) => (
          <G key={x}>
            <Rect x={x} y={172} width={16} height={GROUND - 172} fill={c.door} />
            {[175, 179, 183, 187].map((y) => (
              <Rect key={y} x={x} y={y} width={16} height={0.8} fill={c.doorLine} />
            ))}
          </G>
        ))}

        {/* Right: the vaulted hall, blue band, clerestory and roller doors. */}
        <Path d="M278 140 Q338 114 398 140 Z" fill={c.vault} />
        <Path d="M338 127 Q370 129 398 140 L338 140 Z" fill={c.vaultShade} />
        <Rect x={280} y={140} width={116} height={GROUND - 140} fill={c.wall} />
        <Rect x={280} y={143} width={116} height={3} fill={c.band} />
        <Rect x={286} y={150} width={104} height={4} fill={c.ribbon} />
        {[300, 332, 364].map((x) => (
          <G key={x}>
            <Rect x={x} y={162} width={22} height={GROUND - 162} fill={c.door} />
            {[166, 170, 174, 178, 182, 186].map((y) => (
              <Rect key={y} x={x} y={y} width={22} height={0.8} fill={c.doorLine} />
            ))}
          </G>
        ))}

        {/* The main block: the THACO sign along the top, three storeys of glass, side windows, entrance canopy and doors. */}
        <Circle cx={FASCIA.x + FASCIA.w / 2} cy={FASCIA.y + FASCIA.h / 2} r={110} fill="url(#signGlow)" />
        <Rect x={FASCIA.x + 4} y={FASCIA.y + FASCIA.h} width={FASCIA.w - 8} height={GROUND - FASCIA.y - FASCIA.h} fill={c.wall} />
        <Rect x={FASCIA.x + FASCIA.w - 22} y={FASCIA.y + FASCIA.h} width={18} height={GROUND - FASCIA.y - FASCIA.h} fill={c.wallShade} />
        <Rect x={FASCIA.x - 2} y={FASCIA.y - 3} width={FASCIA.w + 4} height={3} fill={c.fasciaCap} />
        <Rect x={FASCIA.x} y={FASCIA.y} width={FASCIA.w} height={FASCIA.h} fill={c.fascia} />
        <SvgImage
          href={images.wordmark}
          x={FASCIA.x + (FASCIA.w - LOGO_W) / 2}
          y={FASCIA.y + (FASCIA.h - LOGO_H) / 2}
          width={LOGO_W}
          height={LOGO_H}
          preserveAspectRatio="xMidYMid meet"
        />
        <Rect
          x={CURTAIN.x}
          y={CURTAIN.y}
          width={CURTAIN.cols * CURTAIN.pane}
          height={CURTAIN.rows * CURTAIN.row}
          fill={c.glass}
          fillOpacity={c.glassOpacity}
        />
        {litPanes.map(([col, row]) => (
          <Rect
            key={`${col}-${row}`}
            x={CURTAIN.x + col * CURTAIN.pane}
            y={CURTAIN.y + row * CURTAIN.row}
            width={CURTAIN.pane}
            height={CURTAIN.row}
            fill={c.windowLit}
            fillOpacity={c.windowLitOpacity * 0.5}
          />
        ))}
        {Array.from({ length: CURTAIN.cols - 1 }, (_, i) => (
          <Rect key={i} x={CURTAIN.x + (i + 1) * CURTAIN.pane - 0.6} y={CURTAIN.y} width={1.2} height={CURTAIN.rows * CURTAIN.row} fill={c.wall} />
        ))}
        {Array.from({ length: CURTAIN.rows - 1 }, (_, i) => (
          <Rect key={i} x={CURTAIN.x} y={CURTAIN.y + (i + 1) * CURTAIN.row - 1} width={CURTAIN.cols * CURTAIN.pane} height={2} fill={c.wall} />
        ))}
        {[124, 140, 244, 260].map((x) => (
          <Rect key={x} x={x} y={170} width={12} height={9} fill={c.glass} fillOpacity={c.glassOpacity * 0.7} />
        ))}
        <Rect x={180} y={164} width={52} height={4} fill={c.canopy} />
        <Rect x={188} y={168} width={36} height={GROUND - 168} fill={c.glass} fillOpacity={c.glassOpacity} />
        <Rect x={205.4} y={168} width={1.2} height={GROUND - 168} fill={c.wall} />

        {/* The guard post: the flag and the booth with its lit window and the signal on green. */}
        <Rect x={42} y={126} width={1.2} height={GROUND - 126} fill={c.flagPole} />
        <Rect x={43.2} y={127} width={12} height={8} fill="#DA251D" />
        <Path d="M49.2 128.6 L50 130.6 L52.1 130.6 L50.4 131.8 L51 133.8 L49.2 132.6 L47.4 133.8 L48 131.8 L46.3 130.6 L48.4 130.6 Z" fill="#FFDE00" />
        <Rect x={52} y={158} width={34} height={GROUND - 158} fill={c.booth} />
        <Rect x={52} y={GROUND - 4} width={34} height={4} fill={c.boothShade} />
        <Rect x={48} y={152} width={42} height={6} fill={c.boothRoof} />
        <Rect x={56} y={163} width={20} height={13} fill={c.boothWindow} />
        <Rect x={65.4} y={163} width={1.2} height={13} fill={c.booth} />
        <Rect x={78.5} y={161} width={5} height={10} rx={1} fill={c.barrierPost} />
        <Circle cx={81} cy={163.6} r={1.5} fill={c.barrierRed} fillOpacity={0.35} />
        <Circle cx={81} cy={168.2} r={1.6} fill={c.lamp} />

        {/* Trees at the sides. */}
        {trees.map(({ x, r }) => (
          <G key={x}>
            <Rect x={x - 1.2} y={GROUND - 12} width={2.4} height={12} fill={c.trunk} />
            <Circle cx={x} cy={GROUND - r - 8} r={r} fill={c.tree} />
            <Circle cx={x + r * 0.55} cy={GROUND - r * 0.7 - 6} r={r * 0.72} fill={c.treeShade} />
          </G>
        ))}

        {/* The fence along the front, left and right of the gate: a low base, two rails and close bars, with a post every
            28. The sliding gate leaf stands rolled open along the right-hand fence. */}
        {[
          [-4, PILLARS[0]],
          [PILLARS[1] + PILLAR_W, VIEW_W + 6],
        ].map(([from, to]) => (
          <G key={from}>
            <Rect x={from} y={FENCE_TOP} width={to - from} height={GROUND - 4 - FENCE_TOP} fill="url(#fenceBars)" />
            <Rect x={from} y={FENCE_TOP} width={to - from} height={1.2} fill={c.fence} />
            <Rect x={from} y={FENCE_TOP + 6} width={to - from} height={1} fill={c.fence} />
            <Rect x={from} y={GROUND - 4} width={to - from} height={4} fill={c.fenceBase} />
            {Array.from({ length: Math.floor((to - from) / 28) }, (_, i) => (
              <Rect key={i} x={from + 14 + i * 28} y={FENCE_TOP - 2} width={2.2} height={GROUND - FENCE_TOP + 2} fill={c.fence} />
            ))}
          </G>
        ))}
        <G>
          <Rect x={178} y={172} width={46} height={15} fill="url(#gateBars)" />
          <Rect x={178} y={172} width={46} height={1.6} fill={c.fence} />
          <Rect x={178} y={185.4} width={46} height={1.6} fill={c.fence} />
          <Rect x={178} y={172} width={1.6} height={15} fill={c.fence} />
          <Rect x={222.4} y={172} width={1.6} height={15} fill={c.fence} />
          {[183, 219].map((x) => (
            <Circle key={x} cx={x} cy={188.6} r={1.4} fill={c.fence} />
          ))}
        </G>

        {/* The gate's pillars with a cap and a lamp on top each, and the barrier: its post inside the left pillar and the
            striped arm raised for the coach. */}
        {PILLARS.map((x) => (
          <G key={x}>
            <Circle cx={x + PILLAR_W / 2} cy={155} r={10} fill="url(#pillarGlow)" />
            <Rect x={x} y={160} width={PILLAR_W} height={GROUND - 160} fill={c.pillar} />
            <Rect x={x + PILLAR_W - 2.4} y={160} width={2.4} height={GROUND - 160} fill={c.pillarShade} />
            <Rect x={x - 1} y={157} width={PILLAR_W + 2} height={3} fill={c.pillarCap} />
            <Rect x={x + PILLAR_W / 2 - 0.6} y={153.5} width={1.2} height={3.5} fill={c.pillarCap} />
            <Circle cx={x + PILLAR_W / 2} cy={152.6} r={2.2} fill={c.pillarLamp} />
          </G>
        ))}
        <Rect x={BARRIER.x} y={166} width={5} height={GROUND - 166} fill={c.barrierPost} />
        <G transform={`rotate(${BARRIER.angle} ${BARRIER.pivot.x} ${BARRIER.pivot.y})`}>
          <Rect x={BARRIER.pivot.x + 2} y={BARRIER.pivot.y - 2} width={BARRIER.length} height={4} fill={c.barrierWhite} />
          {[0, 16, 32, 48].map((dx) => (
            <Rect key={dx} x={BARRIER.pivot.x + 2 + dx} y={BARRIER.pivot.y - 2} width={8} height={4} fill={c.barrierRed} />
          ))}
        </G>
        <Circle cx={BARRIER.pivot.x} cy={BARRIER.pivot.y} r={3.2} fill={c.barrierPost} />

        {/* In front: a strip of lawn, the yard with rows of finished cars, and the road up to the gate with its centre
            line; the coach on it, driving in. */}
        <Rect x={-VIEW_W} y={GROUND} width={VIEW_W * 3} height={6} fill={c.lawn} />
        <Rect x={-VIEW_W} y={GROUND + 6} width={VIEW_W * 3} height={VIEW_H - GROUND - 6} fill={c.yard} />
        {parkedCars.map(({ x, y, color }) => (
          <ParkedCar key={`${x}-${y}`} x={x} y={y} color={c.cars[color]} glass={c.carGlass} wheel={c.wheel} />
        ))}
        <Path
          d={`M${LANE.left} ${GROUND} L${LANE.right} ${GROUND} L${ROAD_FOOT.right} ${VIEW_H} L${ROAD_FOOT.left} ${VIEW_H} Z`}
          fill={c.road}
        />
        <G fill={c.roadLine}>
          {[
            [196, 3, 1],
            [206, 5, 1.4],
            [220, 7, 1.8],
            [238, 9, 2.2],
            [260, 11, 2.6],
            [286, 13, 3],
          ].map(([y, h, w]) => (
            <Rect key={y} x={(LANE.left + LANE.right) / 2 - w / 2} y={y} width={w} height={h} />
          ))}
        </G>
        <CoachRear cx={(LANE.left + LANE.right) / 2} c={c} />
      </Svg>
      <View className="flex-1" style={{ backgroundColor: c.yard }} />
    </View>
  );
}

/**
 * A 50-seat coach seen from behind as it drives in through the gate: 30 wide and about 47 tall, centred on `cx`, its
 * wheels just in front of the ground line. The roof air-conditioning pod, the big rear window, a white stripe, tail
 * lights in dark frames either side of the engine grille, the number plate, the bumper, the wheels and its shadow.
 */
function CoachRear({ cx, c }: { cx: number; c: ScenePalette }) {
  const x = cx - 15;
  const top = 150;
  return (
    <G>
      <Ellipse cx={cx} cy={196.6} rx={19} ry={2.4} fill="#000000" fillOpacity={c.shadow} />
      {[x + 1.5, x + 22.5].map((wx) => (
        <Rect key={wx} x={wx} y={top + 41} width={6} height={6} rx={1.5} fill={c.wheel} />
      ))}
      <Rect x={x + 4} y={top - 2.5} width={22} height={3.5} rx={1.2} fill={c.busShade} />
      <Rect x={x} y={top} width={30} height={43} rx={3.5} fill={c.bus} />
      <Rect x={x + 3} y={top + 3} width={24} height={14} rx={1.6} fill={c.busGlass} />
      <Rect x={x} y={top + 20} width={30} height={1.8} fill="#FFFFFF" fillOpacity={0.9} />
      {[x + 1.6, x + 25].map((lx) => (
        <G key={lx}>
          <Rect x={lx} y={top + 24} width={3.4} height={13} rx={1} fill={c.wheel} />
          <Rect x={lx + 0.7} y={top + 25} width={2} height={3} fill={c.tailAmber} />
          <Rect x={lx + 0.7} y={top + 29} width={2} height={7} fill={c.tailRed} />
        </G>
      ))}
      {[26, 29, 32].map((dy) => (
        <Rect key={dy} x={x + 7} y={top + dy} width={16} height={0.9} fill={c.busShade} />
      ))}
      <Rect x={cx - 4.5} y={top + 35} width={9} height={3.6} rx={0.5} fill={c.plate} />
      <Rect x={cx - 3} y={top + 36.4} width={6} height={0.8} fill={c.wheel} />
      <Rect x={x - 1} y={top + 39.5} width={32} height={3.5} rx={1.2} fill={c.wheel} fillOpacity={0.85} />
    </G>
  );
}

/** A small car seen from the side, 18 wide and 9 tall, its top-left at `x`, `y`. */
function ParkedCar({ x, y, color, glass, wheel }: { x: number; y: number; color: string; glass: string; wheel: string }) {
  return (
    <G>
      <Path d={`M${x + 4} ${y + 4} L${x + 6.5} ${y} L${x + 12.5} ${y} L${x + 15} ${y + 4} Z`} fill={color} />
      <Path d={`M${x + 6} ${y + 3.6} L${x + 7.4} ${y + 1} L${x + 11.6} ${y + 1} L${x + 13} ${y + 3.6} Z`} fill={glass} />
      <Rect x={x} y={y + 3.6} width={18} height={4} fill={color} />
      <Circle cx={x + 4} cy={y + 7.6} r={1.6} fill={wheel} />
      <Circle cx={x + 14} cy={y + 7.6} r={1.6} fill={wheel} />
    </G>
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
