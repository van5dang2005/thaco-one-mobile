import { memo } from 'react';
import { Circle, Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

import { box, disc, hash, HeaderScene, SCENE, steps } from '@/shared/ui/HeaderScene';

const GROUND = SCENE.ground;

/**
 * Day: an official letter rising out of its envelope with the red seal (con dấu) on it, the rubber stamp beside it, a
 * paper plane taking off and an office block behind. Night: the paper dimmed, the office windows lit. Nothing passes
 * x ≈ 200, where the header's count and its words end, and the plane flies between the subtitle and the search button.
 */
const palettes = {
  light: {
    building: ['#165AA5', '#0B4486'],
    ribbon: '#7FB6EE',
    ribbonOpacity: 0.16,
    edge: '#CFE6FF',
    edgeOpacity: 0.7,
    roofBox: '#0F4E96',
    envBack: '#C9DCF0',
    envFlap: '#B7CFE9',
    envFront: '#EEF5FC',
    envLine: '#B9D3EE',
    paper: '#FFFFFF',
    paperLine: '#C4D8EE',
    paperHead: '#8EB4DD',
    seal: '#E5533D',
    knob: '#0F4E96',
    stampBody: '#0B4486',
    stampShine: '#5D9EE3',
    stampPad: '#B23A2E',
    plane: '#FFFFFF',
    planeFold: '#CFE6FF',
    trail: '#FFFFFF',
    trailOpacity: 0.45,
    tree: '#3E9A72',
    treeShade: '#2F8160',
  },
  dark: {
    building: ['#13294B', '#0B1B35'],
    ribbon: '#2A4466',
    ribbonOpacity: 0.7,
    edge: '#5AA2E6',
    edgeOpacity: 0.5,
    roofBox: '#0E2140',
    envBack: '#5B7393',
    envFlap: '#4E6687',
    envFront: '#8BA3BF',
    envLine: '#6C86A6',
    paper: '#AFC2D8',
    paperLine: '#7890AE',
    paperHead: '#6A84A5',
    seal: '#F07A70',
    knob: '#14304F',
    stampBody: '#0E2140',
    stampShine: '#29507F',
    stampPad: '#8E3A33',
    plane: '#CFE6FF',
    planeFold: '#8CB8E6',
    trail: '#CFE6FF',
    trailOpacity: 0.3,
    tree: '#1F5550',
    treeShade: '#17443F',
  },
};

// ---- geometry -----------------------------------------------------------------------------------

/** The office block on the right edge, under the search button: window ribbons, a lit roof edge, a plant room. */
const OFFICE = { x0: 342, x1: 404, top: 140 };
const OFFICE_BODY = box(OFFICE.x0, OFFICE.top, OFFICE.x1 - OFFICE.x0, GROUND - OFFICE.top) + box(352, OFFICE.top - 5, 14, 5);
const OFFICE_RIBBONS = steps(OFFICE.top + 6, GROUND - 4, 7).map((y) => box(OFFICE.x0 + 4, y, OFFICE.x1 - OFFICE.x0 - 8, 2.6)).join('');
const OFFICE_LIT = steps(OFFICE.top + 6, GROUND - 4, 7)
  .flatMap((y) => steps(OFFICE.x0 + 5, OFFICE.x1 - 6, 6).map((x) => [x, y] as const))
  .filter(([x, y]) => hash(x, y, 5) % 5 === 0)
  .map(([x, y]) => box(x, y, 4, 2.6))
  .join('');

/** The envelope stands on the street, open at the top, its flap folded up behind the letter. */
const ENV = { x0: 222, x1: 296, top: 172, notch: 196, mouth: 178 };
const ENV_MID = (ENV.x0 + ENV.x1) / 2;
const ENV_BACK = box(ENV.x0, ENV.top, ENV.x1 - ENV.x0, GROUND - ENV.top);
const ENV_FLAP = `M${ENV.x0} ${ENV.top}L${ENV_MID} 152L${ENV.x1} ${ENV.top}Z`;
const ENV_FRONT = `M${ENV.x0} ${ENV.mouth}L${ENV_MID} ${ENV.notch}L${ENV.x1} ${ENV.mouth}V${GROUND}H${ENV.x0}Z`;
const ENV_FOLDS = `M${ENV.x0} ${GROUND}L${ENV_MID} ${ENV.notch + 4}L${ENV.x1} ${GROUND}`;

/** The letter: the national heading centred on two lines, a short rule, then the text; the seal over its lower right. */
const LETTER = { x0: 231, x1: 287, top: 145 };
const LETTER_HEAD = box(ENV_MID - 16, LETTER.top + 5, 32, 2.2) + box(ENV_MID - 11, LETTER.top + 9, 22, 1.8) + box(ENV_MID - 6, LETTER.top + 13.5, 12, 0.9);
const LETTER_TEXT = [
  [LETTER.x0 + 5, LETTER.top + 19, 46],
  [LETTER.x0 + 5, LETTER.top + 23.5, 40],
  [LETTER.x0 + 5, LETTER.top + 28, 30],
  [LETTER.x0 + 5, LETTER.top + 32.5, 27],
  [LETTER.x0 + 5, LETTER.top + 37, 31],
  [LETTER.x0 + 5, LETTER.top + 41.5, 22],
]
  .map(([x, y, w]) => box(x, y, w, 1.6))
  .join('');
const SEAL = { x: 276, y: 180, r: 6.5 };
/** A five-pointed star in the seal. */
const SEAL_STAR = (() => {
  const points = Array.from({ length: 10 }, (_, i) => {
    const r = i % 2 ? 1.1 : 2.6;
    const a = (Math.PI / 5) * i - Math.PI / 2;
    return `${(SEAL.x + r * Math.cos(a)).toFixed(2)} ${(SEAL.y + r * Math.sin(a)).toFixed(2)}`;
  });
  return `M${points.join('L')}Z`;
})();

/** The rubber stamp beside the envelope: knob, neck, body, the red pad on the street. */
const STAMP = { x: 319, knobY: 186 };
const STAMP_BODY = box(STAMP.x - 4, 192, 8, 10) + `M${STAMP.x - 15} 204Q${STAMP.x - 15} 201 ${STAMP.x - 12} 201H${STAMP.x + 12}Q${STAMP.x + 15} 201 ${STAMP.x + 15} 204V211H${STAMP.x - 15}Z`;
const STAMP_SHINE = box(STAMP.x - 13, 203, 2, 6.5) + box(STAMP.x - 3, 193, 1.4, 8);
const STAMP_PAD = box(STAMP.x - 14, 211, 28, 3);

/** The paper plane, off the top of the letter, `M` nose: a body and the fold under it, with its dashed trail. */
const PLANE = 'M314 104L289 112.5L297.5 115Z';
const PLANE_FOLD = 'M314 104L297.5 115L299.5 121.5Z';
const TRAIL = 'M262 144C258 130 268 120 280 124C290 127 286 136 279 133C272 130 280 118 293 115';

const TREES: [number, number, number][] = [[210, 205, 6.5], [394, 206, 6]];

/** Sky kept clear of the words: the status bar, the toolbar (title and subtitle to x ≈ 256, search at 346–386), the date and the count. */
const CLOUDS: [number, number, number, number][] = [[290, 86, 0.55, 0.12], [320, 146, 0.6, 0.13], [88, 40, 0.6, 0.1], [212, 66, 0.5, 0.1]];
const STARS: [number, number, number][][] = [
  [[270, 70, 1.1], [330, 64, 1], [322, 140, 1], [214, 140, 0.9], [150, 66, 0.9]],
  [[300, 96, 0.8], [196, 132, 0.7], [236, 154, 0.7], [118, 70, 0.7], [338, 128, 0.7], [256, 62, 0.8]],
  [[180, 74, 0.6], [280, 142, 0.6], [16, 68, 0.6], [232, 72, 0.6], [212, 164, 0.6]],
];

/**
 * The Văn thư home header's picture: an open envelope on the street with an official letter rising out of it (the
 * national heading, its lines, the red seal), a rubber stamp beside it, a paper plane looping away from the letter,
 * and an office block on the right edge. By night the office windows are lit.
 */
export const DocumentsHeaderArt = memo(function DocumentsHeaderArt() {
  return (
    <HeaderScene id="da" clouds={CLOUDS} stars={STARS}>
      {(night) => {
        const c = palettes[night ? 'dark' : 'light'];
        return (
          <>
            <Defs>
              <LinearGradient id="daOffice" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={c.building[0]} />
                <Stop offset="1" stopColor={c.building[1]} />
              </LinearGradient>
            </Defs>

            {/* Office block. */}
            <Path d={OFFICE_BODY} fill="url(#daOffice)" />
            <Path d={OFFICE_RIBBONS} fill={c.ribbon} fillOpacity={c.ribbonOpacity} />
            {night ? <Path d={OFFICE_LIT} fill="#FFD27A" fillOpacity={0.7} /> : null}
            <Rect x={OFFICE.x0} y={OFFICE.top} width={OFFICE.x1 - OFFICE.x0} height={1.5} fill={c.edge} fillOpacity={c.edgeOpacity} />
            {TREES.map(([x, y, r]) => (
              <Path key={x} d={disc(x, y, r) + box(x - 0.8, y + r - 1, 1.6, GROUND - y - r + 1)} fill={c.tree} />
            ))}
            {TREES.map(([x, y, r]) => (
              <Circle key={x} cx={x + r * 0.45} cy={y + r * 0.3} r={r * 0.6} fill={c.treeShade} />
            ))}

            {/* Paper plane and its looping trail, off the top of the letter. */}
            <Path d={TRAIL} stroke={c.trail} strokeOpacity={c.trailOpacity} strokeWidth={1.2} strokeDasharray="3 3" strokeLinecap="round" fill="none" />
            <Path d={PLANE} fill={c.plane} />
            <Path d={PLANE_FOLD} fill={c.planeFold} />

            {/* Envelope: back and flap, the letter with its heading, text and seal, then the front pocket. */}
            <Path d={ENV_BACK} fill={c.envBack} />
            <Path d={ENV_FLAP} fill={c.envFlap} />
            <Rect x={LETTER.x0} y={LETTER.top} width={LETTER.x1 - LETTER.x0} height={GROUND - LETTER.top - 6} rx={1.5} fill={c.paper} />
            <Path d={LETTER_HEAD} fill={c.paperHead} />
            <Path d={LETTER_TEXT} fill={c.paperLine} />
            <Circle cx={SEAL.x} cy={SEAL.y} r={SEAL.r} stroke={c.seal} strokeWidth={1.4} fill="none" />
            <Circle cx={SEAL.x} cy={SEAL.y} r={SEAL.r - 2.2} stroke={c.seal} strokeWidth={0.7} fill="none" />
            <Path d={SEAL_STAR} fill={c.seal} />
            <Path d={ENV_FRONT} fill={c.envFront} />
            <Path d={ENV_FOLDS} stroke={c.envLine} strokeWidth={1} fill="none" />
            <Path d={`M${ENV.x0} ${ENV.mouth}L${ENV_MID} ${ENV.notch}L${ENV.x1} ${ENV.mouth}`} stroke={c.envLine} strokeWidth={1} fill="none" />

            {/* Rubber stamp: red pad on the street, body, neck and knob with a lit edge. */}
            <Path d={STAMP_PAD} fill={c.stampPad} />
            <Path d={STAMP_BODY} fill={c.stampBody} />
            <Circle cx={STAMP.x} cy={STAMP.knobY} r={7} fill={c.knob} />
            <Path d={STAMP_SHINE + disc(STAMP.x - 2.6, STAMP.knobY - 2.6, 2)} fill={c.stampShine} fillOpacity={0.8} />
          </>
        );
      }}
    </HeaderScene>
  );
});
