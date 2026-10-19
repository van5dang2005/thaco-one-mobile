import { memo } from 'react';
import { Circle, Defs, G, LinearGradient, Path, RadialGradient, Rect, Stop } from 'react-native-svg';

import { box, disc, HeaderScene, SCENE, steps } from '@/shared/ui/HeaderScene';

const GROUND = SCENE.ground;

/**
 * Day: a white delivery truck leaving the parcel desk's warehouse in the sun, kraft parcels by its door. Night: the same
 * street with the truck's lights on, the open door glowing warm and a few windows lit. Nothing passes x ≈ 196, where
 * the header's count and its words end.
 */
const palettes = {
  light: {
    wall: ['#14599F', '#0D4A8E'],
    roof: '#0A3F7C',
    edge: '#CFE6FF',
    edgeOpacity: 0.7,
    cladding: '#7FB6EE',
    claddingOpacity: 0.1,
    sign: '#CFE6FF',
    signMark: '#0A57A8',
    frame: '#0A3A70',
    slat: '#8EC1F5',
    slatOpacity: 0.55,
    slatLine: '#0A3A70',
    inside: '#062B57',
    insideBox: '#2A5E96',
    window: '#0A3A70',
    windowShine: '#CFE6FF',
    cargo: '#EEF5FC',
    cargoShade: '#C9DCF0',
    cab: '#DCEAF8',
    glass: '#0A3A70',
    stripe: '#0A57A8',
    dark: '#0A2547',
    hub: '#9CB8D6',
    headlight: '#FFF3C4',
    kraft: '#D9A963',
    kraftShade: '#B98A4A',
    tape: '#F1D3A1',
    pole: '#0A3A70',
    lamp: '#CFE6FF',
    tree: '#3E9A72',
    treeShade: '#2F8160',
  },
  dark: {
    wall: ['#0E2140', '#0B1B35'],
    roof: '#081428',
    edge: '#5AA2E6',
    edgeOpacity: 0.5,
    cladding: '#2A4466',
    claddingOpacity: 0.5,
    sign: '#5AA2E6',
    signMark: '#0B1B35',
    frame: '#060F1E',
    slat: '#29507F',
    slatOpacity: 0.7,
    slatLine: '#060F1E',
    inside: '#FFD27A',
    insideBox: '#B07F3A',
    window: '#FFD27A',
    windowShine: '#FFF1CC',
    cargo: '#8FA6C2',
    cargoShade: '#6F87A6',
    cab: '#7F96B3',
    glass: '#0E2A4A',
    stripe: '#29507F',
    dark: '#050B16',
    hub: '#5B7799',
    headlight: '#FFE7A0',
    kraft: '#8A6A3E',
    kraftShade: '#6E5330',
    tape: '#B08D5A',
    pole: '#13294B',
    lamp: '#FFE7A0',
    tree: '#1F5550',
    treeShade: '#17443F',
  },
};

// ---- geometry -----------------------------------------------------------------------------------
// The toolbar's search and "+" buttons sit at y ≈ 80–124 on the right, so the warehouse roof stays under y 136.

/** The warehouse: a wide gable with the parcel desk's sign, two windows and a roller door half up. */
const HOUSE = { x0: 304, x1: 404, eave: 154, apex: 138, apexX: 354 };
const DOOR = { x0: 330, x1: 374, top: 176, slatsTo: 194 };
const HOUSE_BODY = box(HOUSE.x0, HOUSE.eave, HOUSE.x1 - HOUSE.x0, GROUND - HOUSE.eave);
const HOUSE_ROOF = `M${HOUSE.x0 - 4} ${HOUSE.eave + 1}L${HOUSE.apexX} ${HOUSE.apex}L${HOUSE.x1 + 4} ${HOUSE.eave + 1}V${HOUSE.eave + 4}L${HOUSE.apexX} ${HOUSE.apex + 3}L${HOUSE.x0 - 4} ${HOUSE.eave + 4}Z`;
const HOUSE_GABLE = `M${HOUSE.x0} ${HOUSE.eave + 1}L${HOUSE.apexX} ${HOUSE.apex + 3}L${HOUSE.x1} ${HOUSE.eave + 1}Z`;
const HOUSE_EDGE = `M${HOUSE.x0 - 4} ${HOUSE.eave + 1}L${HOUSE.apexX} ${HOUSE.apex}L${HOUSE.x1 + 4} ${HOUSE.eave + 1}`;
const CLADDING = steps(HOUSE.x0 + 6, HOUSE.x1, 7).map((x) => box(x, HOUSE.eave + 4, 0.8, GROUND - HOUSE.eave - 4)).join('');
const SIGN = { x: 334, y: 159, w: 40, h: 9 };
/** The sign: a small parcel mark and two lines of lettering. */
const SIGN_MARK = box(SIGN.x + 3, SIGN.y + 2, 5, 5) + box(SIGN.x + 11, SIGN.y + 2.5, 22, 1.6) + box(SIGN.x + 11, SIGN.y + 5.2, 15, 1.4);
const FRAME = box(DOOR.x0 - 2, DOOR.top - 2, DOOR.x1 - DOOR.x0 + 4, GROUND - DOOR.top + 2);
const SLATS = box(DOOR.x0, DOOR.top, DOOR.x1 - DOOR.x0, DOOR.slatsTo - DOOR.top);
const SLAT_LINES = steps(DOOR.top + 3, DOOR.slatsTo, 3.2).map((y) => box(DOOR.x0, y, DOOR.x1 - DOOR.x0, 0.7)).join('');
const OPENING = box(DOOR.x0, DOOR.slatsTo, DOOR.x1 - DOOR.x0, GROUND - DOOR.slatsTo);
/** Parcels on the shelves inside the open door. */
const INSIDE_BOXES = box(DOOR.x0 + 4, 205, 9, 9) + box(DOOR.x0 + 14, 201, 11, 13) + box(DOOR.x0 + 30, 207, 8, 7) + box(DOOR.x0 + 6, 198, 6, 7);
const WINDOWS = [box(310, 178, 13, 10), box(382, 178, 13, 10)].join('');
const WINDOW_SHINE = [box(311.5, 179.5, 3, 7), box(383.5, 179.5, 3, 7)].join('');

/** The truck faces left, its nose at x 198: cab, cargo box with the parcel mark, chassis, two wheels. */
const TRUCK = { nose: 198, cabBack: 230, rear: 292, roof: 170, cabTop: 177, floor: 204 };
const CARGO = box(TRUCK.cabBack + 1, TRUCK.roof, TRUCK.rear - TRUCK.cabBack - 1, TRUCK.floor - TRUCK.roof);
const CARGO_SHADE = box(TRUCK.cabBack + 1, TRUCK.floor - 5, TRUCK.rear - TRUCK.cabBack - 1, 5) + box(TRUCK.rear - 4, TRUCK.roof, 4, TRUCK.floor - TRUCK.roof);
const CARGO_PANELS = steps(TRUCK.cabBack + 12, TRUCK.rear - 4, 12).map((x) => box(x, TRUCK.roof + 3, 0.7, TRUCK.floor - TRUCK.roof - 9)).join('');
const STRIPE = box(TRUCK.cabBack + 1, 192, TRUCK.rear - TRUCK.cabBack - 1, 3);
/** The parcel mark on the cargo box: a box outline (even-odd ring), its tape cross, then two lines of lettering. */
const LOGO_RING = 'M248 176h12v12h-12ZM249.6 177.6v8.8h8.8v-8.8Z';
const LOGO_MARKS = box(253.3, 177.6, 1.4, 8.8) + box(249.6, 181.3, 3.7, 1.4) + box(254.7, 181.3, 3.7, 1.4) + box(264, 178.5, 20, 2.4) + box(264, 183, 14, 1.8);
const CAB = `M${TRUCK.cabBack} ${TRUCK.cabTop}H${TRUCK.nose + 10}Q${TRUCK.nose + 6} ${TRUCK.cabTop} ${TRUCK.nose + 4.5} ${TRUCK.cabTop + 4}L${TRUCK.nose} ${TRUCK.cabTop + 13}V${TRUCK.floor}H${TRUCK.cabBack}Z`;
const GLASS = `M${TRUCK.cabBack - 3} ${TRUCK.cabTop + 3}H${TRUCK.nose + 10.5}Q${TRUCK.nose + 8} ${TRUCK.cabTop + 3} ${TRUCK.nose + 7} ${TRUCK.cabTop + 5.5}L${TRUCK.nose + 3.6} ${TRUCK.cabTop + 13}H${TRUCK.cabBack - 3}Z`;
const GLASS_SHINE = `M${TRUCK.nose + 14} ${TRUCK.cabTop + 3}h4l-5 10h-4Z`;
const CAB_DOOR = box(TRUCK.cabBack - 9, TRUCK.cabTop + 3, 0.8, TRUCK.floor - TRUCK.cabTop - 5) + box(TRUCK.cabBack - 14, TRUCK.cabTop + 16, 3, 1.2);
const CHASSIS = box(TRUCK.nose - 1, TRUCK.floor, TRUCK.rear - TRUCK.nose + 1, 3.5) + box(TRUCK.nose - 2, 197, 4, 7);
const WHEELS = [TRUCK.nose + 13, TRUCK.rear - 20].map((x) => disc(x, 208.5, 5.5)).join('');
const HUBS = [TRUCK.nose + 13, TRUCK.rear - 20].map((x) => disc(x, 208.5, 2.2)).join('');
const HEADLIGHT = box(TRUCK.nose - 0.5, 192, 3, 3.5);

/** A street lamp between the truck and the warehouse, its arm over the truck's tail. */
const LAMP = { x: 298, top: 160, headX: 290 };
const LAMP_POST = box(LAMP.x, LAMP.top, 1.6, GROUND - LAMP.top) + `M${LAMP.x + 1.6} ${LAMP.top}H${LAMP.headX + 1}v1.4H${LAMP.x + 1.6}Z` + box(LAMP.headX - 3, LAMP.top + 1, 6, 2);

/** Kraft parcels stacked right of the door, `[x, y, w, h]` from the ground up. */
const PARCELS: [number, number, number, number][] = [[378, 199, 16, 15], [394, 205, 10, 9], [381, 188, 12, 11]];
const PARCEL_BODY = PARCELS.map(([x, y, w, h]) => box(x, y, w, h)).join('');
const PARCEL_SHADE = PARCELS.map(([x, y, w, h]) => box(x + w - 2.5, y, 2.5, h) + box(x, y, w, 1.6)).join('');
const PARCEL_TAPE = PARCELS.map(([x, y, w, h]) => box(x + w / 2 - 1, y, 2, h)).join('');

const TREE = { x: 318, y: 203, r: 7 };

/** Sky kept clear of the words: the status bar, the toolbar (back, title to x ≈ 262, buttons from 316), the date and the count. */
const CLOUDS: [number, number, number, number][] = [[290, 94, 0.6, 0.14], [226, 140, 0.55, 0.12], [372, 132, 0.55, 0.12], [80, 40, 0.6, 0.1]];
const STARS: [number, number, number][][] = [
  [[270, 74, 1.1], [300, 98, 1], [250, 132, 1], [150, 66, 0.9], [372, 136, 0.9]],
  [[210, 140, 0.7], [290, 140, 0.8], [330, 66, 0.8], [118, 70, 0.7], [236, 64, 0.7], [16, 70, 0.6]],
  [[180, 72, 0.6], [272, 118, 0.6], [306, 128, 0.6], [342, 132, 0.6], [200, 160, 0.6]],
];

/**
 * The "Bưu phẩm của tôi" header's picture: the parcel desk's warehouse on the right with its sign, a roller door half up
 * and parcels inside, kraft parcels stacked by the door, a street lamp, and a white delivery truck with the parcel
 * mark pulling out to the left. By night its headlight shines ahead, the doorway and windows glow warm.
 */
export const ParcelsHeaderArt = memo(function ParcelsHeaderArt() {
  return (
    <HeaderScene id="pa" clouds={CLOUDS} stars={STARS}>
      {(night) => {
        const c = palettes[night ? 'dark' : 'light'];
        return (
          <>
            <Defs>
              <LinearGradient id="paWall" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={c.wall[0]} />
                <Stop offset="1" stopColor={c.wall[1]} />
              </LinearGradient>
              <LinearGradient id="paBeam" x1="1" y1="0" x2="0" y2="0">
                <Stop offset="0" stopColor={c.headlight} stopOpacity={0.3} />
                <Stop offset="1" stopColor={c.headlight} stopOpacity={0} />
              </LinearGradient>
              <RadialGradient id="paLampGlow" cx={LAMP.headX} cy={LAMP.top + 4} r="22" gradientUnits="userSpaceOnUse">
                <Stop offset="0" stopColor={c.lamp} stopOpacity={0.35} />
                <Stop offset="1" stopColor={c.lamp} stopOpacity={0} />
              </RadialGradient>
              <LinearGradient id="paSpill" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={c.inside} stopOpacity={0.35} />
                <Stop offset="1" stopColor={c.inside} stopOpacity={0} />
              </LinearGradient>
            </Defs>
            {/* Warehouse: gable, cladding, sign, windows, the roller door half up over the lit or shaded inside. */}
            <Path d={HOUSE_BODY + HOUSE_GABLE} fill="url(#paWall)" />
            <Path d={CLADDING} fill={c.cladding} fillOpacity={c.claddingOpacity} />
            <Path d={HOUSE_ROOF} fill={c.roof} />
            <Path d={HOUSE_EDGE} stroke={c.edge} strokeOpacity={c.edgeOpacity} strokeWidth={1.4} fill="none" />
            <Rect x={SIGN.x} y={SIGN.y} width={SIGN.w} height={SIGN.h} rx={1.5} fill={c.sign} fillOpacity={night ? 0.75 : 0.92} />
            <Path d={SIGN_MARK} fill={c.signMark} />
            <Path d={WINDOWS} fill={c.window} fillOpacity={night ? 0.8 : 1} />
            <Path d={WINDOW_SHINE} fill={c.windowShine} fillOpacity={night ? 0.5 : 0.25} />
            <Path d={FRAME} fill={c.frame} />
            <Path d={OPENING} fill={c.inside} fillOpacity={night ? 0.85 : 1} />
            <Path d={INSIDE_BOXES} fill={c.insideBox} />
            <Path d={SLATS} fill={c.slat} fillOpacity={c.slatOpacity} />
            <Path d={SLAT_LINES} fill={c.slatLine} fillOpacity={0.5} />
            {night ? <Path d={`M${DOOR.x0} ${GROUND}H${DOOR.x1}L${DOOR.x1 + 6} ${GROUND + 12}H${DOOR.x0 - 6}Z`} fill="url(#paSpill)" /> : null}

            {/* Parcels by the door: kraft, a shaded side and lid, the tape down the middle. */}
            <Path d={PARCEL_BODY} fill={c.kraft} />
            <Path d={PARCEL_SHADE} fill={c.kraftShade} />
            <Path d={PARCEL_TAPE} fill={c.tape} fillOpacity={0.85} />

            <Circle cx={TREE.x} cy={TREE.y} r={TREE.r} fill={c.tree} />
            <Circle cx={TREE.x + 3} cy={TREE.y + 2} r={TREE.r * 0.6} fill={c.treeShade} />
            <Rect x={TREE.x - 0.8} y={TREE.y + TREE.r - 1} width={1.6} height={GROUND - TREE.y - TREE.r + 1} fill={c.treeShade} />

            {/* Street lamp, glowing at night. */}
            {night ? <Circle cx={LAMP.headX} cy={LAMP.top + 4} r={22} fill="url(#paLampGlow)" /> : null}
            <Path d={LAMP_POST} fill={c.pole} />
            <Rect x={LAMP.headX - 2.5} y={LAMP.top + 3} width={5} height={1.4} fill={c.lamp} fillOpacity={night ? 1 : 0.7} />

            {/* The truck: white cargo box with the parcel mark and a blue stripe, cab, chassis, wheels. */}
            {night ? <Path d={`M${TRUCK.nose} 193.5L${TRUCK.nose - 34} 184L${TRUCK.nose - 34} 206Z`} fill="url(#paBeam)" /> : null}
            <Path d={CARGO} fill={c.cargo} />
            <Path d={CARGO_SHADE} fill={c.cargoShade} />
            <Path d={CARGO_PANELS} fill={c.cargoShade} fillOpacity={0.8} />
            <Path d={STRIPE} fill={c.stripe} />
            <Path d={LOGO_RING} fill={c.stripe} fillRule="evenodd" />
            <Path d={LOGO_MARKS} fill={c.stripe} />
            <Rect x={TRUCK.cabBack + 1} y={TRUCK.roof} width={TRUCK.rear - TRUCK.cabBack - 1} height={1.4} fill="#FFFFFF" fillOpacity={night ? 0.2 : 0.7} />
            <Path d={CAB} fill={c.cab} />
            <Path d={GLASS} fill={c.glass} />
            <Path d={GLASS_SHINE} fill="#FFFFFF" fillOpacity={night ? 0.12 : 0.28} />
            <Path d={CAB_DOOR} fill={c.dark} fillOpacity={0.35} />
            <Path d={CHASSIS} fill={c.dark} />
            <Path d={HEADLIGHT} fill={c.headlight} />
            <G>
              <Path d={WHEELS} fill={c.dark} />
              <Path d={HUBS} fill={c.hub} />
            </G>
          </>
        );
      }}
    </HeaderScene>
  );
});
