import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { useProfile } from '@/core/session/useMe';
import { useTheme } from '@/core/theme/ThemeProvider';
import { formatTime } from '@/core/time/vn';
import { bookingFrom } from '@/features/room-booking/utils/booking';
import { useNow } from '@/shared/hooks/useNow';
import { initialsOf } from '@/shared/ui/Avatar';
import { Icon } from '@/shared/ui/Icon';
import { type AppIcon, CalendarOffIcon, DoorOpenIcon, PlusIcon } from '@/shared/ui/icons';
import { HeaderCircles } from '@/shared/ui/ModuleHeader';
import { onBlue, useHeaderColors } from '@/shared/ui/ScreenShell';
import { Skeleton } from '@/shared/ui/Skeleton';
import { Text } from '@/shared/ui/Text';

import { useGreeting } from '../hooks/useGreeting';
import { pickNextMeeting, useTodayMeetings } from '../hooks/useSignals';

type Props = {
  /** "Họp tiếp theo" row (layout sheet switch; also needs the room service). */
  showNextMeeting: boolean;
  /** "Đặt phòng" when there is no meeting left today. */
  onBook?: () => void;
};

/** Blue greeting card (2c): avatar 48, time-of-day greeting, name, unit, then my next meeting today. */
export function HeroCard({ showNextMeeting, onBook }: Props) {
  const { t } = useTranslation();
  const { colors, scheme } = useTheme();
  const { fg, text2, accent } = useHeaderColors();
  const profile = useProfile();
  const greeting = useGreeting();
  const unit = [profile.departmentName, profile.unitName].filter(Boolean).join(' · ');

  return (
    <View
      testID="home-hero"
      className="gap-3.5 overflow-hidden rounded-[24px] p-4"
      // Dark mode: deep navy instead of the near-black header color, with a lit top edge, so the card stands off the page.
      // Light sets the width to 0 rather than dropping it: on Android a removed borderWidth leaves this rounded clip
      // empty and the whole card blank after switching dark → light.
      style={[{ backgroundColor: colors.hero }, scheme === 'dark' ? { borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.08)', borderTopColor: 'rgba(255, 255, 255, 0.18)' } : { borderWidth: 0 }]}
    >
      <HeaderCircles />
      <View className="flex-row items-center gap-3">
        <View className="h-12 w-12 items-center justify-center overflow-hidden rounded-full border-2" style={{ borderColor: onBlue(0.85), backgroundColor: '#DCE8F4' }}>
          {profile.avatarUrl ? (
            <Image source={{ uri: profile.avatarUrl }} style={{ width: 44, height: 44 }} contentFit="cover" transition={120} accessibilityIgnoresInvertColors />
          ) : (
            <Text weight="bold" style={{ fontSize: 16, lineHeight: 20, color: '#00539B' }}>
              {initialsOf(profile.fullname)}
            </Text>
          )}
        </View>
        <View className="min-w-0 flex-1">
          <View className="flex-row items-center gap-1.5">
            <Icon icon={greeting.icon} size={14} weight="bold" rawColor={accent} />
            <Text weight="semibold" numberOfLines={1} style={{ fontSize: 12, lineHeight: 16, color: accent }}>
              {t(`home.greeting.${greeting.key}`)}
            </Text>
          </View>
          {profile.isLoading && !profile.fullname ? (
            <View className="mt-1.5 gap-1.5">
              <Skeleton width={170} height={18} />
              <Skeleton width={130} height={11} />
            </View>
          ) : (
            <>
              <Text weight="bold" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85} accessibilityRole="header" style={{ fontSize: 18, lineHeight: 24, letterSpacing: -0.2, color: fg }}>
                {profile.fullname ?? '—'}
              </Text>
              {unit ? (
                <Text numberOfLines={1} style={{ fontSize: 12, lineHeight: 16, color: text2 }}>
                  {unit}
                </Text>
              ) : null}
            </>
          )}
        </View>
      </View>
      {showNextMeeting ? <NextMeetingRow onBook={onBook} /> : null}
    </View>
  );
}

/** White 12% row: door icon, "Họp tiếp theo · <phòng>", title, start time (mono 15). */
function NextMeetingRow({ onBook }: { onBook?: () => void }) {
  const { t } = useTranslation();
  const { fg, text2 } = useHeaderColors();
  const meetings = useTodayMeetings();
  const now = useNow();
  const next = pickNextMeeting(meetings.data, now);
  const booking = next?.booking;
  const box = 'min-h-[56px] flex-row items-center gap-3 rounded-[16px] px-3 py-2.5';

  if (meetings.isLoading) {
    return (
      <View className={box} style={{ backgroundColor: onBlue(0.12) }}>
        <Skeleton width={32} height={32} radius={9} />
        <View className="flex-1 gap-1.5">
          <Skeleton width="45%" height={10} />
          <Skeleton width="70%" height={13} />
        </View>
      </View>
    );
  }

  if (!booking) {
    return (
      <View testID="home-next-meeting" className={box} style={{ backgroundColor: onBlue(0.12) }}>
        <RowIcon icon={CalendarOffIcon} />
        <Text numberOfLines={2} className="flex-1" style={{ fontSize: 13, lineHeight: 17, color: text2 }}>
          {t('home.nextMeeting.none')}
        </Text>
        {onBook ? (
          <Pressable testID="home-today-book" accessibilityRole="button" onPress={onBook} hitSlop={6} className="h-8 flex-row items-center gap-1 rounded-full bg-white px-3 active:opacity-70">
            <Icon icon={PlusIcon} size={14} weight="bold" rawColor="#00539B" />
            <Text weight="bold" style={{ fontSize: 12, lineHeight: 16, color: '#00539B' }}>
              {t('home.nextMeeting.book')}
            </Text>
          </Pressable>
        ) : null}
      </View>
    );
  }

  const title = booking.content?.trim() || t('home.today.untitled');
  const label = [next.live ? t('home.nextMeeting.live') : t('home.nextMeeting.label'), booking.room?.name].filter(Boolean).join(' · ');
  const start = formatTime(bookingFrom(booking));

  return (
    <Pressable
      testID="home-next-meeting"
      accessibilityRole="button"
      accessibilityLabel={`${label}, ${title}, ${start}`}
      onPress={() => router.push({ pathname: '/rooms/bookings/[id]', params: { id: booking.id } })}
      className={`${box} active:opacity-80`}
      style={{ backgroundColor: onBlue(0.12) }}
    >
      <RowIcon />
      <View className="min-w-0 flex-1">
        <Text numberOfLines={1} style={{ fontSize: 11, lineHeight: 14, color: text2 }}>
          {label}
        </Text>
        <Text weight="bold" numberOfLines={1} style={{ fontSize: 14, lineHeight: 19, color: fg }}>
          {title}
        </Text>
      </View>
      <Text mono weight="semibold" maxFontSizeMultiplier={1.15} style={{ fontSize: 15, lineHeight: 19, color: fg }}>
        {start}
      </Text>
    </Pressable>
  );
}

function RowIcon({ icon = DoorOpenIcon }: { icon?: AppIcon }) {
  return (
    <View className="h-8 w-8 items-center justify-center rounded-[9px] bg-white">
      <Icon icon={icon} size={16} rawColor="#00539B" />
    </View>
  );
}
