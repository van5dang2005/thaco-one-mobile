import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useEffect, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import Animated, { FadeInDown, ZoomIn } from 'react-native-reanimated';

import { useTheme } from '@/core/theme/ThemeProvider';
import { Button } from '@/shared/ui/Button';
import { Card, FloatingCard } from '@/shared/ui/Card';
import { Icon } from '@/shared/ui/Icon';
import { type AppIcon, CalendarXIcon, LightbulbIcon, RotateCcwIcon, ScanQrCodeIcon, WifiOffIcon, XIcon } from '@/shared/ui/icons';
import { ModuleScreen } from '@/shared/ui/ModuleScreen';
import { Text } from '@/shared/ui/Text';
import { type Tone, useToneColors } from '@/shared/ui/tones';

import { GuestError } from '../types';
import { guestErrorMessage } from '../utils/errors';

/** `invalid`: not a guest QR; `expired`: the visit is over; `failed`: the lookup itself failed (network, server). */
type ErrorKind = 'invalid' | 'expired' | 'failed';

function kindOf(error: unknown): ErrorKind {
  if (error instanceof GuestError) return error.code === 'GUEST_VISIT_EXPIRED' ? 'expired' : 'invalid';
  return 'failed';
}

const looks: Record<ErrorKind, { icon: AppIcon; tone: Tone; badge?: AppIcon }> = {
  invalid: { icon: ScanQrCodeIcon, tone: 'danger', badge: XIcon },
  expired: { icon: CalendarXIcon, tone: 'warn' },
  failed: { icon: WifiOffIcon, tone: 'off' },
};

const copy = {
  invalid: {
    title: 'guestSchedule.scanError.invalid.title',
    tipsTitle: 'guestSchedule.scanError.invalid.tipsTitle',
    tips: ['guestSchedule.scanError.invalid.tip1', 'guestSchedule.scanError.invalid.tip2', 'guestSchedule.scanError.invalid.tip3'],
  },
  expired: {
    title: 'guestSchedule.scanError.expired.title',
    tipsTitle: 'guestSchedule.scanError.expired.tipsTitle',
    tips: ['guestSchedule.scanError.expired.tip1', 'guestSchedule.scanError.expired.tip2'],
  },
  failed: {
    title: 'guestSchedule.scanError.failed.title',
    tipsTitle: 'guestSchedule.scanError.failed.tipsTitle',
    tips: ['guestSchedule.scanError.failed.tip1'],
  },
} as const;

type Props = {
  /** The screen's blue header (bottom 18: the result card overlaps it). */
  header: ReactNode;
  error: unknown;
  /** What the camera read. */
  qr: string;
  retrying: boolean;
  onRetry: () => void;
};

/**
 * A scan that leads nowhere: the result card over the header (glyph, what went wrong, what was read), then what to
 * check. A wrong or expired code offers another scan; a failed lookup offers to try the same code again.
 */
export function ScanErrorScreen({ header, error, qr, retrying, onRetry }: Props) {
  const { t } = useTranslation();
  const kind = kindOf(error);
  const text = copy[kind];
  const rescan = () => router.dismissTo('/guests/scan');

  useEffect(() => {
    if (kind !== 'failed') void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
  }, [kind]);

  const result = (
    <FloatingCard radius={20} className="items-center px-5 pb-5 pt-6" testID={`guest-scan-error-${kind}`}>
      <ErrorGlyph kind={kind} />
      <Animated.View entering={FadeInDown.delay(120).duration(280)} className="mt-4 w-full items-center gap-1.5">
        <Text weight="bold" accessibilityRole="header" className="text-center" style={{ fontSize: 19, lineHeight: 25 }}>
          {t(text.title)}
        </Text>
        <Text className="text-center text-muted" style={{ fontSize: 14, lineHeight: 20 }}>
          {guestErrorMessage(error, t)}
        </Text>
      </Animated.View>
      {qr.trim() ? (
        <View className="mt-4 w-full gap-0.5 rounded-[14px] bg-field px-3.5 py-2.5">
          <Text className="text-meta text-muted">{t('guestSchedule.scanError.scanned')}</Text>
          <Text testID="guest-scan-error-raw" mono selectable numberOfLines={2} className="text-ink-2" style={{ fontSize: 13, lineHeight: 18 }}>
            {qr.trim()}
          </Text>
        </View>
      ) : null}
    </FloatingCard>
  );

  return (
    <ModuleScreen
      header={header}
      floating={result}
      floatingScrolls
      footer={
        kind === 'failed' ? (
          <>
            <Button testID="guest-scan-error-rescan" className="flex-1" variant="ghost" label={t('guestSchedule.checkIn.rescan')} onPress={rescan} />
            <Button testID="guest-scan-error-retry" className="flex-[1.6]" icon={RotateCcwIcon} label={t('common.retry')} loading={retrying} onPress={onRetry} />
          </>
        ) : (
          <>
            <Button testID="guest-scan-error-home" className="flex-1" variant="ghost" label={t('guestSchedule.scanError.home')} onPress={() => router.dismissTo('/')} />
            <Button testID="guest-scan-error-rescan" className="flex-[1.6]" icon={ScanQrCodeIcon} label={t('guestSchedule.checkIn.rescan')} onPress={rescan} />
          </>
        )
      }
    >
      <Animated.View entering={FadeInDown.delay(220).duration(280)}>
        <Card className="gap-3 p-4">
          <View className="flex-row items-center gap-2">
            <Icon icon={LightbulbIcon} size={17} color="warning" />
            <Text weight="semibold" accessibilityRole="header" style={{ fontSize: 14.5, lineHeight: 19 }}>
              {t(text.tipsTitle)}
            </Text>
          </View>
          {text.tips.map((tip, index) => (
            <View key={tip} className="flex-row items-start gap-2.5">
              <View className="mt-px h-5 w-5 items-center justify-center rounded-full bg-primary-tint">
                <Text numeric weight="bold" className="text-primary-tint-text" style={{ fontSize: 11, lineHeight: 14 }}>
                  {index + 1}
                </Text>
              </View>
              <Text className="min-w-0 flex-1 text-ink-2" style={{ fontSize: 13.5, lineHeight: 19 }}>
                {t(tip)}
              </Text>
            </View>
          ))}
        </Card>
      </Animated.View>
    </ModuleScreen>
  );
}

/** 84pt tinted disc with the kind's glyph; a wrong code also gets a red ✕ on its corner. */
function ErrorGlyph({ kind }: { kind: ErrorKind }) {
  const { colors } = useTheme();
  const look = looks[kind];
  const tone = useToneColors(look.tone);
  return (
    <Animated.View entering={ZoomIn.springify().damping(14)}>
      <View className="h-[84px] w-[84px] items-center justify-center rounded-full" style={{ backgroundColor: tone.tint }}>
        <Icon icon={look.icon} size={38} rawColor={tone.solid} />
      </View>
      {look.badge ? (
        <View
          className="absolute -bottom-0.5 -right-0.5 h-[30px] w-[30px] items-center justify-center rounded-full"
          style={{ backgroundColor: tone.solid, borderWidth: 3, borderColor: colors.elevated }}
        >
          <Icon icon={look.badge} size={14} weight="bold" rawColor="#FFFFFF" />
        </View>
      ) : null}
    </Animated.View>
  );
}
