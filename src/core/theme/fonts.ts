// Deep imports: each package root re-exports all 18 weights/italics, which Metro would bundle.
import { BeVietnamPro_400Regular } from '@expo-google-fonts/be-vietnam-pro/400Regular';
import { BeVietnamPro_500Medium } from '@expo-google-fonts/be-vietnam-pro/500Medium';
import { BeVietnamPro_600SemiBold } from '@expo-google-fonts/be-vietnam-pro/600SemiBold';
import { BeVietnamPro_700Bold } from '@expo-google-fonts/be-vietnam-pro/700Bold';
import { JetBrainsMono_400Regular } from '@expo-google-fonts/jetbrains-mono/400Regular';
import { JetBrainsMono_500Medium } from '@expo-google-fonts/jetbrains-mono/500Medium';
import { JetBrainsMono_600SemiBold } from '@expo-google-fonts/jetbrains-mono/600SemiBold';
import { JetBrainsMono_700Bold } from '@expo-google-fonts/jetbrains-mono/700Bold';
import type { TextStyle } from 'react-native';

export type FontWeight = 'regular' | 'medium' | 'semibold' | 'bold';

/** Be Vietnam Pro for the whole UI (design v3); covers Vietnamese diacritics. */
export const uiAssets = { BeVietnamPro_400Regular, BeVietnamPro_500Medium, BeVietnamPro_600SemiBold, BeVietnamPro_700Bold };

/** One family per weight: on Android, fontWeight alone does not switch faces of a custom font. */
const uiFamily: Record<FontWeight, string> = {
  regular: 'BeVietnamPro_400Regular',
  medium: 'BeVietnamPro_500Medium',
  semibold: 'BeVietnamPro_600SemiBold',
  bold: 'BeVietnamPro_700Bold',
};

/** JetBrains Mono for MSNV, codes, times and counts. */
export const monoAssets = { JetBrainsMono_400Regular, JetBrainsMono_500Medium, JetBrainsMono_600SemiBold, JetBrainsMono_700Bold };

const monoFamily: Record<FontWeight, string> = {
  regular: 'JetBrainsMono_400Regular',
  medium: 'JetBrainsMono_500Medium',
  semibold: 'JetBrainsMono_600SemiBold',
  bold: 'JetBrainsMono_700Bold',
};

/** Text style for a weight: Be Vietnam Pro, or JetBrains Mono for codes and numbers. */
export function fontStyle(weight: FontWeight = 'regular', mono = false): TextStyle {
  return { fontFamily: mono ? monoFamily[weight] : uiFamily[weight] };
}

/** Hook form kept for the callers (`Text`, inputs); the typeface no longer changes at runtime. */
export function useFontStyle(weight: FontWeight = 'regular', mono = false): TextStyle {
  return fontStyle(weight, mono);
}

/**
 * Upper bound for Dynamic Type / font scale so dense layouts stay usable, down to 360dp Android phones
 * (720px wide) at the largest system font.
 */
export const MAX_FONT_SCALE = 1.2;

/** A text's own `maxFontSizeMultiplier`, which may only tighten `MAX_FONT_SCALE` (RN reads 0 / unset as "no limit"). */
export function capFontScale(multiplier?: number | null): number {
  return multiplier && multiplier >= 1 ? Math.min(multiplier, MAX_FONT_SCALE) : MAX_FONT_SCALE;
}
