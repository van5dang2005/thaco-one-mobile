import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { cn } from '@/shared/lib/cn';
import { goBack } from '@/shared/lib/navigation';

import { HeaderIconButton, HeaderTitleIcon } from './HeaderBar';
import { Icon } from './Icon';
import { type AppIcon, ChevronDownIcon, ChevronLeftIcon, XIcon } from './icons';
import { onBlue, useHeaderColors, useLightStatusBar } from './ScreenShell';
import { Text } from './Text';

type Props = {
  /** Left out when the subtitle picker says enough (Lịch phòng: the area); the picker then takes the toolbar's height. */
  title?: string;
  /** Glyph in a round chip before the title (what the screen is about). */
  icon?: AppIcon;
  /** Second line under the title (#C9DCEF): area, opening hours, a short summary. */
  subtitle?: string;
  /** Subtitle in JetBrains Mono (booking codes). */
  subtitleMono?: boolean;
  /** Glyph before the subtitle (map pin for the area). */
  subtitleIcon?: AppIcon;
  /** Makes the subtitle a picker: a translucent pill with a chevron, so it reads as a button (change area, unit). */
  onSubtitlePress?: () => void;
  /** `back` (default) / `close` show a 40×40 button before the title; `none` for tab roots. */
  leading?: 'back' | 'close' | 'none';
  onBack?: () => void;
  /** Buttons on the right of the toolbar (HeaderIconButton), 8 apart. */
  right?: ReactNode;
  /** `md` 18/700 (default), `lg` 22/700 for tab roots (Hộp duyệt). */
  titleSize?: 'md' | 'lg';
  /** Screen-specific content under the toolbar: stepper, day strip, segmented, stats. */
  children?: ReactNode;
  /** Padding under the content: 44 when a FloatingCard overlaps the header (default), less otherwise. */
  bottom?: number;
  /** A picture behind the header in place of the two faint circles (Văn thư, Bưu phẩm: `HeaderScene`). */
  art?: ReactNode;
  testID?: string;
};

/**
 * Blue module header (v3): safe area + 10 on top, 16 sides, two faint white circles on the right,
 * a 40pt toolbar (back · title + subtitle · actions) and the screen's own content below it.
 */
export function ModuleHeader({ title, icon, subtitle, subtitleMono, subtitleIcon, onSubtitlePress, leading = 'back', onBack, right, titleSize = 'md', children, bottom = 44, art, testID }: Props) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { bg, fg, text2: sub } = useHeaderColors();
  useLightStatusBar();
  const large = titleSize === 'lg';

  const subtitleRow = !subtitle ? null : onSubtitlePress ? (
    <Pressable
      testID={`${testID ?? 'header'}-subtitle`}
      accessibilityRole="button"
      hitSlop={6}
      onPress={onSubtitlePress}
      className={cn('flex-row items-center self-start rounded-full active:opacity-70', title ? 'mt-1 h-[26px] gap-1 pl-2 pr-1.5' : 'h-10 max-w-full gap-1 pl-3.5 pr-2.5')}
      style={{ backgroundColor: onBlue(0.16) }}
    >
      {subtitleIcon ? <Icon icon={subtitleIcon} size={title ? 13 : 15} rawColor={fg} /> : null}
      <Text
        weight="semibold"
        numberOfLines={1}
        maxFontSizeMultiplier={1.2}
        className="flex-shrink"
        style={{ fontSize: title ? 12.5 : 14, lineHeight: title ? 16 : 19, color: fg }}
      >
        {subtitle}
      </Text>
      <Icon icon={ChevronDownIcon} size={title ? 14 : 16} weight="bold" rawColor={fg} />
    </Pressable>
  ) : (
    <View className="flex-row items-center gap-1">
      {subtitleIcon ? <Icon icon={subtitleIcon} size={12} rawColor={sub} /> : null}
      <Text mono={subtitleMono} numberOfLines={1} className="flex-shrink" style={{ fontSize: 12, lineHeight: 16, color: sub }}>
        {subtitle}
      </Text>
    </View>
  );

  return (
    <View testID={testID} className="overflow-hidden" style={{ backgroundColor: bg, paddingTop: insets.top + 10, paddingHorizontal: 16, paddingBottom: bottom }}>
      {art ?? <HeaderCircles />}
      <View className="min-h-10 flex-row items-center gap-3">
        {leading === 'none' ? null : (
          <HeaderIconButton
            testID={`${testID ?? 'header'}-leading`}
            icon={leading === 'close' ? XIcon : ChevronLeftIcon}
            label={leading === 'close' ? t('common.close') : t('common.back')}
            onPress={onBack ?? (() => goBack())}
          />
        )}
        {icon ? <HeaderTitleIcon icon={icon} size={large ? 40 : 36} /> : null}
        <View className="min-w-0 flex-1">
          {title ? (
            <Text
              weight="bold"
              numberOfLines={1}
              accessibilityRole="header"
              style={{ fontSize: large ? 22 : 18, lineHeight: large ? 28 : 23, letterSpacing: large ? -0.4 : -0.2, color: fg }}
            >
              {title}
            </Text>
          ) : null}
          {subtitleRow}
        </View>
        {right ? <View className="flex-row items-center gap-2">{right}</View> : null}
      </View>
      {children ? <View className="mt-3.5">{children}</View> : null}
    </View>
  );
}

/** The two decorative circles of every blue header (220 at right:-70/top:-60, 110 at right:40/top:70). */
export function HeaderCircles() {
  return (
    <View pointerEvents="none" style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 }}>
      <View style={{ position: 'absolute', width: 220, height: 220, borderRadius: 110, right: -70, top: -60, backgroundColor: 'rgba(255, 255, 255, 0.06)' }} />
      <View style={{ position: 'absolute', width: 110, height: 110, borderRadius: 55, right: 40, top: 70, backgroundColor: 'rgba(255, 255, 255, 0.05)' }} />
    </View>
  );
}
