import { memo } from 'react';
import { Circle, Defs, G, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

import { box, disc, HeaderScene, SCENE } from '@/shared/ui/HeaderScene';

const GROUND = SCENE.ground;

/**
 * Day: a phone standing on the street with a stack of notifications on its screen, one popping out, and a golden
 * bell ringing beside it. Night: the screen glows, the bell dims. The header's count and its words end at x ≈ 210,
 * the "Đọc tất cả" pill sits above y ≈ 108 on the right and the chips run along the ground, so the picture keeps to
 * x ≥ 236 between them.
 */
const palettes = {
  light: {
    body: ['#0F4E96', '#0B3D78'],
    edge: '#5D9EE3',
    screen: ['#F4F9FF', '#DCEBFA'],
    card: '#FFFFFF',
    cardEdge: '#C9DCF0',
    line: '#C4D8EE',
    lineStrong: '#8EB4DD',
    dots: ['#E5533D', '#F5A524', '#22A06B', '#2E7CD6'],
    bell: ['#FFD36E', '#F2A93B'],
    bellShine: '#FFF0C2',
    bellLip: '#E39622',
    clapper: '#C77E16',
    waves: '#FFFFFF',
    wavesOpacity: 0.55,
    badge: '#E5533D',
    badgeRing: '#FFFFFF',
  },
  dark: {
    body: ['#14304F', '#0B1B35'],
    edge: '#29507F',
    screen: ['#244A7A', '#16335A'],
    card: '#2F5585',
    cardEdge: '#3D6699',
    line: '#4E74A3',
    lineStrong: '#6E93C0',
    dots: ['#F07A70', '#E9B35A', '#4CC08D', '#5AA2E6'],
    bell: ['#D9AE55', '#B88634'],
    bellShine: '#F0D49A',
    bellLip: '#A5772A',
    clapper: '#8A6224',
    waves: '#CFE6FF',
    wavesOpacity: 0.35,
    badge: '#F07A70',
    badgeRing: '#0B1B35',
  },
};

// ---- geometry -----------------------------------------------------------------------------------

/** The phone stands on the street at the right edge, under the "Đọc tất cả" pill. */
const PHONE = { x0: 330, x1: 386, top: 110, r: 9 };
const SCREEN = { x0: PHONE.x0 + 4, x1: PHONE.x1 - 4, top: PHONE.top + 11, bottom: GROUND - 4 };
const SPEAKER = box((PHONE.x0 + PHONE.x1) / 2 - 7, PHONE.top + 4.5, 14, 2.2);

/** Notification cards stacked on the screen, newest on top: `[y, dot colour index, first line width]`. */
const CARDS: [number, number, number][] = [
  [SCREEN.top + 5, 0, 26],
  [SCREEN.top + 23, 1, 22],
  [SCREEN.top + 41, 2, 28],
  [SCREEN.top + 59, 3, 20],
];
const CARD = { x0: SCREEN.x0 + 3, width: SCREEN.x1 - SCREEN.x0 - 6, height: 14 };

/** The one popping out of the phone towards the bell, tilted a little. */
const POP = { x: 284, y: 160, width: 40, height: 15 };
const POP_TILT = `rotate(-8 ${POP.x + POP.width / 2} ${POP.y + POP.height / 2})`;

/** The bell between the count and the phone: dome, flared lip, clapper, knob; ringing, sound waves and a red badge. */
const BELL = { cx: 276, top: 118, lip: 156 };
const BELL_BODY =
  `M${BELL.cx} ${BELL.top}C${BELL.cx - 11} ${BELL.top} ${BELL.cx - 16} ${BELL.top + 9} ${BELL.cx - 16} ${BELL.top + 19}` +
  `V${BELL.lip - 9}L${BELL.cx - 22} ${BELL.lip}H${BELL.cx + 22}L${BELL.cx + 16} ${BELL.lip - 9}V${BELL.top + 19}` +
  `C${BELL.cx + 16} ${BELL.top + 9} ${BELL.cx + 11} ${BELL.top} ${BELL.cx} ${BELL.top}Z`;
const BELL_SHINE = `M${BELL.cx - 10} ${BELL.top + 20}C${BELL.cx - 10} ${BELL.top + 12} ${BELL.cx - 6} ${BELL.top + 7} ${BELL.cx - 1} ${BELL.top + 6}C${BELL.cx - 5} ${BELL.top + 10} ${BELL.cx - 6} ${BELL.top + 15} ${BELL.cx - 6} ${BELL.top + 22}V${BELL.lip - 12}H${BELL.cx - 10}Z`;
const WAVES = [
  `M${BELL.cx - 27} ${BELL.top + 10}Q${BELL.cx - 33} ${BELL.top + 21} ${BELL.cx - 27} ${BELL.top + 32}`,
  `M${BELL.cx - 34} ${BELL.top + 5}Q${BELL.cx - 42} ${BELL.top + 21} ${BELL.cx - 34} ${BELL.top + 37}`,
  `M${BELL.cx + 27} ${BELL.top + 10}Q${BELL.cx + 33} ${BELL.top + 21} ${BELL.cx + 27} ${BELL.top + 32}`,
].join('');
const BADGE = { x: BELL.cx + 13, y: BELL.top + 5, r: 6 };

/** Sky kept clear of the words: the status bar, the title (to x ≈ 190), the pill (x ≈ 280–390, y ≈ 68–108), the count. */
const CLOUDS: [number, number, number, number][] = [[230, 96, 0.5, 0.1], [96, 44, 0.6, 0.1], [196, 62, 0.45, 0.08]];
const STARS: [number, number, number][][] = [
  [[236, 84, 1.1], [312, 118, 1], [150, 62, 0.9], [394, 104, 0.9], [226, 176, 0.9]],
  [[250, 106, 0.8], [318, 146, 0.7], [118, 70, 0.7], [214, 128, 0.7], [62, 56, 0.7]],
  [[180, 74, 0.6], [16, 68, 0.6], [240, 150, 0.6], [304, 98, 0.6]],
];

/**
 * The notifications header's picture: a phone on the street showing a stack of coloured notifications and a golden
 * bell beside it, over the shared sky and skyline (`HeaderScene`). While something is unread (`ringing`) the bell
 * rings with a red badge and a notification pops out of the phone towards it; once all is read it hangs still.
 */
export const NotificationsHeaderArt = memo(function NotificationsHeaderArt({ ringing }: { ringing: boolean }) {
  return (
    <HeaderScene id="na" clouds={CLOUDS} stars={STARS}>
      {(night) => {
        const c = palettes[night ? 'dark' : 'light'];
        return (
          <>
            <Defs>
              <LinearGradient id="naBody" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={c.body[0]} />
                <Stop offset="1" stopColor={c.body[1]} />
              </LinearGradient>
              <LinearGradient id="naScreen" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={c.screen[0]} />
                <Stop offset="1" stopColor={c.screen[1]} />
              </LinearGradient>
              <LinearGradient id="naBell" x1="0" y1="0" x2="1" y2="0">
                <Stop offset="0" stopColor={c.bell[0]} />
                <Stop offset="1" stopColor={c.bell[1]} />
              </LinearGradient>
            </Defs>

            {/* Phone: body with a lit edge and speaker, the screen, the stack of notifications. */}
            <Rect x={PHONE.x0} y={PHONE.top} width={PHONE.x1 - PHONE.x0} height={GROUND - PHONE.top + 8} rx={PHONE.r} fill="url(#naBody)" />
            <Rect x={PHONE.x0 + 0.8} y={PHONE.top + 0.8} width={PHONE.x1 - PHONE.x0 - 1.6} height={GROUND - PHONE.top} rx={PHONE.r - 0.8} stroke={c.edge} strokeWidth={1} fill="none" />
            <Path d={SPEAKER} fill={c.edge} />
            <Rect x={SCREEN.x0} y={SCREEN.top} width={SCREEN.x1 - SCREEN.x0} height={SCREEN.bottom - SCREEN.top} rx={4} fill="url(#naScreen)" />
            {CARDS.map(([y]) => (
              <Rect key={y} x={CARD.x0} y={y} width={CARD.width} height={CARD.height} rx={3} fill={c.card} stroke={c.cardEdge} strokeWidth={0.6} />
            ))}
            <Path d={CARDS.map(([y, , w]) => box(CARD.x0 + 9, y + 4, w, 1.8)).join('')} fill={c.lineStrong} />
            <Path d={CARDS.map(([y, , w]) => box(CARD.x0 + 9, y + 8.4, w - 8, 1.5)).join('')} fill={c.line} />
            {CARDS.map(([y, dot]) => (
              <Circle key={y} cx={CARD.x0 + 4.5} cy={y + 7} r={2.2} fill={c.dots[dot]} />
            ))}

            {/* The notification popping out, tilted towards the bell. */}
            {ringing ? (
              <G transform={POP_TILT}>
                <Rect x={POP.x} y={POP.y} width={POP.width} height={POP.height} rx={3.5} fill={c.card} stroke={c.cardEdge} strokeWidth={0.6} />
                <Path d={box(POP.x + 11, POP.y + 4.5, 22, 1.8) + box(POP.x + 11, POP.y + 9, 15, 1.5)} fill={c.lineStrong} />
                <Circle cx={POP.x + 6} cy={POP.y + 8.6} r={2.6} fill={c.dots[0]} />
              </G>
            ) : null}

            {/* Bell: waves, clapper, dome with a shine, lip, knob, and the red badge. */}
            {ringing ? <Path d={WAVES} stroke={c.waves} strokeOpacity={c.wavesOpacity} strokeWidth={2} strokeLinecap="round" fill="none" /> : null}
            <Path d={disc(BELL.cx, BELL.lip + 5, 4.2)} fill={c.clapper} />
            <Path d={BELL_BODY} fill="url(#naBell)" />
            <Path d={BELL_SHINE} fill={c.bellShine} fillOpacity={0.7} />
            <Rect x={BELL.cx - 23} y={BELL.lip - 1} width={46} height={4} rx={2} fill={c.bellLip} />
            <Path d={disc(BELL.cx, BELL.top - 2, 3)} fill={c.bellLip} />
            {ringing ? (
              <>
                <Circle cx={BADGE.x} cy={BADGE.y} r={BADGE.r + 1.6} fill={c.badgeRing} />
                <Circle cx={BADGE.x} cy={BADGE.y} r={BADGE.r} fill={c.badge} />
              </>
            ) : null}
          </>
        );
      }}
    </HeaderScene>
  );
});
