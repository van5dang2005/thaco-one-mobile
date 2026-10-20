import { Image } from 'expo-image';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { useTheme } from '@/core/theme/ThemeProvider';
import { images, WORDMARK_RATIO } from '@/shared/assets';
import { cn } from '@/shared/lib/cn';
import { goBack } from '@/shared/lib/navigation';

import { CountBadge } from './CountBadge';
import { Icon } from './Icon';
import { type AppIcon, ChevronDownIcon, ChevronLeftIcon, XIcon } from './icons';
import { onBlue, useHeaderColors } from './ScreenShell';
import { Text } from './Text';

type Props = {
  title?: string;
  /** Glyph in a round chip before the title (what the screen is about). */
  icon?: AppIcon;
  /** THACO wordmark instead of a title (home). */
  logo?: boolean;
  /** `back` (default) goes back, `close` shows ✕, `none` hides the button (tab roots). */
  leading?: 'back' | 'close' | 'none';
  onBack?: () => void;
  /** Replaces the leading button (home menu). */
  left?: ReactNode;
  right?: ReactNode;
  testID?: string;
};

/** 44pt toolbar on the blue header: 44×44 back button, 17/600 white title on one line, right slot. */
export function HeaderBar({ title, icon, logo, leading = 'back', onBack, left, right, testID }: Props) {
  const { t } = useTranslation();
  const { fg } = useHeaderColors();

  return (
    <View testID={testID} className="h-11 flex-row items-center gap-1">
      {left ??
        (leading === 'none' ? (
          <View className="w-2" />
        ) : (
          <Pressable
            testID={`${testID ?? 'header'}-leading`}
            accessibilityRole="button"
            accessibilityLabel={leading === 'close' ? t('common.close') : t('common.back')}
            onPress={onBack ?? (() => goBack())}
            className="h-11 w-11 items-center justify-center active:opacity-60"
          >
            <Icon icon={leading === 'close' ? XIcon : ChevronLeftIcon} size={22} weight="bold" rawColor={fg} />
          </Pressable>
        ))}
      {logo ? (
        <View className="flex-1 pl-1" accessibilityRole="header" accessibilityLabel="THACO">
          <Image source={images.wordmark} style={{ height: 16, width: 16 * WORDMARK_RATIO }} contentFit="contain" accessibilityIgnoresInvertColors />
        </View>
      ) : (
        <View className="min-w-0 flex-1 flex-row items-center gap-2.5">
          {icon ? <HeaderTitleIcon icon={icon} size={30} /> : null}
          <Text weight="semibold" numberOfLines={1} accessibilityRole="header" className="flex-shrink" style={{ fontSize: 17, lineHeight: 22, color: fg }}>
            {title ?? ''}
          </Text>
        </View>
      )}
      {right ? <View className="flex-row items-center gap-2 pr-1">{right}</View> : null}
    </View>
  );
}

/**
 * Round chip (white 16% fill, 22% ring) holding the screen's glyph next to a header title. Round so it
 * never reads as one of the square header buttons beside it.
 */
export function HeaderTitleIcon({ icon, size = 36 }: { icon: AppIcon; size?: number }) {
  const { fg } = useHeaderColors();
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      className="items-center justify-center rounded-full"
      style={{ width: size, height: size, backgroundColor: onBlue(0.16), borderWidth: 1, borderColor: onBlue(0.22) }}
    >
      <Icon icon={icon} size={Math.round(size * 0.5)} rawColor={fg} />
    </View>
  );
}

type IconButtonProps = {
  icon: AppIcon;
  label: string;
  onPress: () => void;
  /** `tint` = 40×40 square, radius 12, white 14% (default); `plain` = bare 44pt icon; `solid` = white square, primary icon. */
  variant?: 'tint' | 'plain' | 'solid';
  /** Red count on the top-right corner (notifications, approvals). */
  badge?: number;
  /** Other overlays. */
  children?: ReactNode;
  testID?: string;
};

/** Icon button on the blue header (back, search, filters, notifications). */
export function HeaderIconButton({ icon, label, onPress, variant = 'tint', badge, children, testID }: IconButtonProps) {
  const { colors } = useTheme();
  const { fg } = useHeaderColors();
  const plain = variant === 'plain';
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={badge ? `${label}, ${badge}` : label}
      onPress={onPress}
      hitSlop={plain ? 0 : 2}
      className={cn('items-center justify-center active:opacity-70', plain ? 'h-11 w-11' : 'h-10 w-10 rounded-[12px]')}
      style={plain ? undefined : { backgroundColor: variant === 'solid' ? colors['header-name'] : onBlue(0.14) }}
    >
      <Icon icon={icon} size={plain ? 22 : 19} weight={variant === 'solid' ? 'bold' : 'regular'} rawColor={variant === 'solid' ? colors.header : fg} />
      {badge ? <CountBadge count={badge} ring="header" className="absolute -right-1.5 -top-1.5" /> : null}
      {children}
    </Pressable>
  );
}

/** 34pt pill button on the blue header ("Ủy quyền", "Chọn nhiều", "Lịch của tôi"); `caret` adds a ▾ (pickers). */
export function HeaderPillButton({ icon, label, onPress, caret, testID }: { icon?: AppIcon; label: string; onPress: () => void; caret?: boolean; testID?: string }) {
  const { fg } = useHeaderColors();
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      onPress={onPress}
      hitSlop={{ top: 5, bottom: 5 }}
      className="h-[34px] flex-row items-center justify-center gap-1.5 rounded-full px-3 active:opacity-70"
      style={{ backgroundColor: onBlue(0.14) }}
    >
      {icon ? <Icon icon={icon} size={15} rawColor={fg} /> : null}
      <Text weight="semibold" numberOfLines={1} style={{ fontSize: 12.5, lineHeight: 16, color: fg }}>
        {label}
      </Text>
      {caret ? <Icon icon={ChevronDownIcon} size={13} weight="bold" rawColor={fg} /> : null}
    </Pressable>
  );
}

/** Main action on the blue header: small white 28pt pill with a primary glyph and label ("Đặt phòng"). */
export function HeaderActionButton({ icon, label, accessibilityLabel, onPress, testID }: { icon: AppIcon; label: string; accessibilityLabel?: string; onPress: () => void; testID?: string }) {
  const { colors } = useTheme();
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      onPress={onPress}
      hitSlop={{ top: 8, bottom: 8 }}
      className="h-7 flex-row items-center justify-center gap-0.5 rounded-full pl-2 pr-2.5 active:opacity-70"
      style={{ backgroundColor: colors['header-name'] }}
    >
      <Icon icon={icon} size={12} weight="bold" rawColor={colors.header} />
      <Text weight="bold" numberOfLines={1} maxFontSizeMultiplier={1.15} style={{ fontSize: 11.5, lineHeight: 14, color: colors.header }}>
        {label}
      </Text>
    </Pressable>
  );
}
