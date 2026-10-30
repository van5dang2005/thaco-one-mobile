import { Platform, Text as RNText, type TextProps as RNTextProps } from 'react-native';

import { capFontScale, useFontStyle, type FontWeight } from '@/core/theme/fonts';
import { cn } from '@/shared/lib/cn';

export type TextProps = RNTextProps & {
  weight?: FontWeight;
  /** JetBrains Mono, for codes that must be read character by character (mã vận đơn, MSNV, version). */
  mono?: boolean;
  /** UI font with tabular figures, for times, dates and counts that line up in columns. */
  numeric?: boolean;
  className?: string;
};

export function Text({ weight = 'regular', mono = false, numeric = false, className, style, maxFontSizeMultiplier, ...rest }: TextProps) {
  const font = useFontStyle(weight, mono);
  return (
    <RNText
      // Android's default "highQuality" breaking mis-measures custom fonts and clips the last word.
      textBreakStrategy={Platform.OS === 'android' ? 'simple' : undefined}
      {...rest}
      maxFontSizeMultiplier={capFontScale(maxFontSizeMultiplier)}
      className={cn('text-body text-ink', className)}
      style={[font, numeric && tabular, style]}
    />
  );
}

const tabular = { fontVariant: ['tabular-nums' as const] };
