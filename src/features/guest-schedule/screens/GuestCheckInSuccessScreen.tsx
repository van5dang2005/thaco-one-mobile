import * as Haptics from 'expo-haptics';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { setStatusBarStyle } from 'expo-status-bar';
import { useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { BackHandler, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, ZoomIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { formatDate, formatTime, parseServerDate } from '@/core/time/vn';
import { useTheme } from '@/core/theme/ThemeProvider';
import { cn } from '@/shared/lib/cn';
import { Button } from '@/shared/ui/Button';
import { Icon } from '@/shared/ui/Icon';
import { type AppIcon, CheckIcon, ClockIcon, MapPinIcon, UsersIcon } from '@/shared/ui/icons';
import { Text } from '@/shared/ui/Text';

/** Confetti around the check mark: offset from its center, size, turn, color token. */
const CONFETTI = [
  { x: -78, y: -46, w: 7, h: 4, rotate: 30, color: 'primary' },
  { x: 70, y: -62, w: 6, h: 6, rotate: 45, color: 'primary' },
  { x: -96, y: 22, w: 8, h: 4, rotate: -20, color: 'success' },
  { x: 92, y: 14, w: 6, h: 4, rotate: 60, color: 'warning' },
  { x: 58, y: 58, w: 7, h: 4, rotate: -40, color: 'primary' },
  { x: -54, y: 66, w: 5, h: 5, rotate: 15, color: 'warning' },
  { x: 8, y: -88, w: 7, h: 4, rotate: 80, color: 'success' },
  { x: 108, y: -24, w: 5, h: 5, rotate: 10, color: 'danger' },
] as const;

/**
 * "Check-in thành công!" or, after letting a group out (`kind` out), "Check-out thành công!": the group, when it passed
 * the gate, head count and place. Its button (and Android's Back) goes back to "Lịch khách", not to the camera under it.
 */
export function GuestCheckInSuccessScreen() {
  const { t } = useTranslation();
  const { colors, scheme } = useTheme();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ kind?: string; name?: string; at?: string; count?: string; location?: string }>();
  const at = parseServerDate(params.at);

  useFocusEffect(
    useCallback(() => {
      setStatusBarStyle(scheme === 'dark' ? 'light' : 'dark');
    }, [scheme]),
  );

  useFocusEffect(
    useCallback(() => {
      const sub = BackHandler.addEventListener('hardwareBackPress', () => {
        toDashboard();
        return true;
      });
      return () => sub.remove();
    }, []),
  );

  useEffect(() => {
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, []);

  return (
    <View testID="guest-check-in-success" className="flex-1 bg-surface px-5" style={{ paddingTop: insets.top + 56, paddingBottom: Math.max(insets.bottom, 16) + 8 }}>
      <View className="flex-1 items-center">
        <View className="h-[200px] w-[260px] items-center justify-center">
          {CONFETTI.map((piece, index) => (
            <Animated.View
              key={index}
              entering={FadeIn.delay(220 + index * 40).duration(300)}
              style={{
                position: 'absolute',
                left: 130 + piece.x,
                top: 100 + piece.y,
                width: piece.w,
                height: piece.h,
                borderRadius: 1.5,
                backgroundColor: colors[piece.color],
                transform: [{ rotate: `${piece.rotate}deg` }],
              }}
            />
          ))}
          <Animated.View
            entering={ZoomIn.springify().damping(12)}
            className="h-[96px] w-[96px] items-center justify-center rounded-full"
            style={{ backgroundColor: colors.success, boxShadow: `0 10px 24px ${colors['success-tint']}` }}
          >
            <Icon icon={CheckIcon} size={48} weight="bold" rawColor="#FFFFFF" />
          </Animated.View>
        </View>

        <Animated.View entering={FadeInDown.delay(150).duration(320)} className="w-full items-center gap-2">
          <Text weight="bold" accessibilityRole="header" className="text-center" style={{ fontSize: 24, lineHeight: 31 }}>
            {t(params.kind === 'out' ? 'guestSchedule.success.titleOut' : 'guestSchedule.success.title')}
          </Text>
          {params.name ? (
            <Text weight="semibold" className="mt-2 text-center text-ink-2" style={{ fontSize: 17, lineHeight: 23 }}>
              {params.name}
            </Text>
          ) : null}
          {at ? (
            <View className="flex-row items-center gap-1.5">
              <Icon icon={ClockIcon} size={16} color="ink-2" />
              <Text numeric className="text-ink-2" style={{ fontSize: 15, lineHeight: 20 }}>
                {`${formatTime(at)} - ${formatDate(at)}`}
              </Text>
            </View>
          ) : null}
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(260).duration(320)} className="mt-8 w-full">
          <View className="rounded-card bg-panel px-4 py-1">
            <Row icon={UsersIcon} text={t('guestSchedule.success.guests', { count: Number(params.count) || 0 })} />
            {params.location ? <Row icon={MapPinIcon} text={params.location} divider /> : null}
          </View>
        </Animated.View>
      </View>

      <Button testID="guest-success-home" size="xl" pill label={t('guestSchedule.success.home')} onPress={toDashboard} />
    </View>
  );
}

/** Back to "Lịch khách": pops to it when it is under this screen, else (a deep link) puts it in this screen's place. */
function toDashboard() {
  router.dismissTo('/guests');
}

function Row({ icon, text, divider }: { icon: AppIcon; text: string; divider?: boolean }) {
  return (
    <View className={cn('flex-row items-center gap-3 py-3.5', divider && 'border-t border-line-2')}>
      <Icon icon={icon} size={20} color="primary" />
      <Text className="min-w-0 flex-1 text-ink-2" style={{ fontSize: 14, lineHeight: 19 }}>
        {text}
      </Text>
    </View>
  );
}
