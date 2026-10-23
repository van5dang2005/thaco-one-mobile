import { useEffect, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { KeyboardAvoidingView, Modal, Pressable, ScrollView, useWindowDimensions, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';

import { useTheme } from '@/core/theme/ThemeProvider';
import { cn } from '@/shared/lib/cn';

import { Icon } from './Icon';
import { type AppIcon, XIcon } from './icons';
import { RoundIcon, type RoundIconTone } from './RoundIcon';
import { Text } from './Text';

type Props = {
  visible: boolean;
  onClose: () => void;
  title?: string;
  /** Mono caption: above the title, or under it when the sheet has an `icon` ("PH-2610-0183 · Cấp 2/2"). */
  caption?: string;
  /** Plain second line under the title (icon headers): "Chọn cách sắp xếp tiện ích". */
  subtitle?: string;
  /** 44pt rounded-square icon before the title, plus a close button on the right (design 3h, 2h). */
  icon?: AppIcon;
  iconTone?: RoundIconTone;
  children: ReactNode;
  footer?: ReactNode;
  /** Wrap the body in a ScrollView (long lists). */
  scrollable?: boolean;
  /** Max height as a fraction of the window. */
  maxHeightRatio?: number;
  /** A smaller icon heading (36pt icon, 16pt title, 32pt close) for short pickers. */
  compact?: boolean;
  testID?: string;
};

const DURATION = 240;
/** rgba(11, 20, 32, .55) behind the sheet. */
const BACKDROP = '#0B1420';
const BACKDROP_OPACITY = 0.55;

/** Bottom sheet: slides up over a dimmed backdrop, 28pt top radius, 40×5 grab handle. */
export function BottomSheet({ visible, onClose, title, caption, subtitle, icon, iconTone = 'ok', children, footer, scrollable, maxHeightRatio = 0.9, compact, testID }: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const [mounted, setMounted] = useState(visible);
  const progress = useSharedValue(0);

  // Keep the Modal mounted until the exit animation has finished.
  if (visible && !mounted) setMounted(true);

  useEffect(() => {
    if (visible) {
      progress.set(withTiming(1, { duration: DURATION, easing: Easing.out(Easing.cubic) }));
    } else if (mounted) {
      progress.set(
        withTiming(0, { duration: 200, easing: Easing.in(Easing.cubic) }, (finished) => {
          if (finished) scheduleOnRN(setMounted, false);
        }),
      );
    }
  }, [visible, mounted, progress]);

  const backdropStyle = useAnimatedStyle(() => ({ opacity: progress.get() * BACKDROP_OPACITY }));
  const sheetStyle = useAnimatedStyle(() => ({ transform: [{ translateY: (1 - progress.get()) * height }] }));

  if (!mounted) return null;

  const body = scrollable ? (
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: 14, paddingBottom: 4 }} showsVerticalScrollIndicator={false}>
      {children}
    </ScrollView>
  ) : (
    <View style={{ gap: 14 }}>{children}</View>
  );

  const heading = icon ? (
    <View className="flex-row items-center gap-3">
      <RoundIcon icon={icon} size={compact ? 36 : 44} tone={iconTone} square />
      <View className="min-w-0 flex-1 gap-0.5">
        {title ? (
          <Text weight="bold" numberOfLines={2} accessibilityRole="header" style={{ fontSize: compact ? 16 : 17, lineHeight: compact ? 20 : 21 }}>
            {title}
          </Text>
        ) : null}
        {caption ? (
          <Text mono numberOfLines={1} className="text-muted" style={{ fontSize: 11.5, lineHeight: 15 }}>
            {caption}
          </Text>
        ) : null}
        {subtitle ? (
          <Text numberOfLines={2} className="text-muted" style={{ fontSize: compact ? 12 : 12.5, lineHeight: compact ? 16 : 17 }}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('common.close')}
        onPress={onClose}
        hitSlop={6}
        className={cn('items-center justify-center active:opacity-70', compact ? 'h-8 w-8 rounded-[10px]' : 'h-9 w-9 rounded-[12px]')}
        style={{ backgroundColor: colors.field }}
      >
        <Icon icon={XIcon} size={16} weight="bold" color="muted" />
      </Pressable>
    </View>
  ) : caption || title ? (
    <View className="gap-1">
      {caption ? (
        <Text mono weight="medium" className="text-meta text-muted">
          {caption}
        </Text>
      ) : null}
      {title ? (
        <Text weight="bold" className="text-sheet" accessibilityRole="header">
          {title}
        </Text>
      ) : null}
    </View>
  ) : null;

  return (
    <Modal visible transparent animationType="none" statusBarTranslucent navigationBarTranslucent onRequestClose={onClose}>
      <KeyboardAvoidingView behavior="padding" style={{ flex: 1, justifyContent: 'flex-end' }}>
        <Animated.View style={[{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: BACKDROP }, backdropStyle]}>
          <Pressable accessibilityRole="button" accessibilityLabel={t('common.close')} style={{ flex: 1 }} onPress={onClose} />
        </Animated.View>
        <Animated.View
          testID={testID}
          style={[
            {
              backgroundColor: colors.surface,
              borderTopLeftRadius: 28,
              borderTopRightRadius: 28,
              maxHeight: height * maxHeightRatio,
              paddingBottom: Math.max(insets.bottom, 16) + 8,
            },
            sheetStyle,
          ]}
        >
          <View className="items-center pb-2 pt-2.5">
            <View className="h-[5px] w-10 rounded-[3px] bg-input-border" />
          </View>
          <View className="flex-shrink px-4" style={{ gap: 14 }}>
            {heading}
            {body}
            {footer}
          </View>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
