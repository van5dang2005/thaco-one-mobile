import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { qk } from '@/core/query/keys';
import { formatDayMonth, formatTime, parseServerDate } from '@/core/time/vn';
import { cn } from '@/shared/lib/cn';
import { Avatar } from '@/shared/ui/Avatar';
import { Banner } from '@/shared/ui/Banner';
import { BottomSheet } from '@/shared/ui/BottomSheet';
import { Button } from '@/shared/ui/Button';
import { Icon } from '@/shared/ui/Icon';
import { type AppIcon, BuildingIcon, CalendarCheckIcon, CalendarIcon, LogOutIcon, ShieldCheckIcon, UsersIcon } from '@/shared/ui/icons';
import type { RoundIconTone } from '@/shared/ui/RoundIcon';
import { SectionTitle } from '@/shared/ui/SectionTitle';
import { Skeleton } from '@/shared/ui/Skeleton';
import { StatStrip } from '@/shared/ui/StatStrip';
import { StatusBadge } from '@/shared/ui/StatusBadge';
import { Text } from '@/shared/ui/Text';

import { guestApi } from '../api/guest.api';
import { type GateRecord, GuestError, type GuestScheduleItem, type GuestVisitStatus } from '../types';
import { visitEnd, visitStart } from '../utils/dashboard';
import { visitStatusKinds } from './VisitCard';

const iconTones: Record<GuestVisitStatus, RoundIconTone> = { pending: 'warn', checkedIn: 'ok', checkedOut: 'off', rejected: 'danger' };

/**
 * A visit of the list in full: the group with its registration number, status and guest type, then head count, start
 * and end, the receiving units, and from the QR lookup when it passed the gate and the guests by name. A group inside
 * that may leave now gets "Xác nhận ra cổng" (the gate screen for its code); one inside that may not yet (office hours,
 * reception has checked no one in) says why. `visit` null closes it.
 */
export function VisitDetailSheet({ visit, onClose }: { visit: GuestScheduleItem | null; onClose: () => void }) {
  const { t } = useTranslation();
  // The last visit stays on the sheet while it slides away.
  const [shown, setShown] = useState(visit);
  if (visit && visit !== shown) setShown(visit);

  const token = shown?.qrToken ?? '';
  const details = useQuery({
    queryKey: qk.guests.visit(token),
    queryFn: () => guestApi.lookup(token),
    enabled: !!visit && !!token,
    retry: false,
    staleTime: 60_000,
  });

  if (!shown) return null;
  const start = visitStart(shown);
  const end = visitEnd(shown);
  const extra = details.data;
  // A wrong or ended QR only means there is nothing more to show; anything else (network, server) can be retried.
  const failed = details.isError && !(details.error instanceof GuestError);
  const gateRecord = (record: GateRecord) => {
    const at = parseServerDate(record.at);
    const when = at ? `${formatTime(at)} ${formatDayMonth(at)}` : '';
    return record.count === null ? when : `${when} · ${t('guestSchedule.view.guests', { count: record.count })}`;
  };
  const checkOut = () => {
    onClose();
    router.push({ pathname: '/guests/check-in', params: { qr: token } });
  };

  return (
    <BottomSheet
      testID="guests-visit-sheet"
      visible={!!visit}
      onClose={onClose}
      icon={UsersIcon}
      iconTone={iconTones[shown.status]}
      title={shown.groupName}
      caption={shown.code}
      scrollable
      footer={
        extra?.canCheckOut ? (
          <Button testID="guests-visit-sheet-check-out" icon={LogOutIcon} label={t('guestSchedule.detail.checkOut')} onPress={checkOut} />
        ) : undefined
      }
    >
      <View className="flex-row flex-wrap items-center gap-2">
        <StatusBadge kind={visitStatusKinds[shown.status]} label={t(`guestSchedule.dashboard.status.${shown.status}`)} />
        {shown.guestType ? (
          <Text numberOfLines={1} className="flex-shrink text-muted" style={{ fontSize: 13, lineHeight: 18 }}>
            {shown.guestType}
          </Text>
        ) : null}
      </View>

      <View className="overflow-hidden rounded-[16px] border border-line-2">
        <StatStrip
          items={[
            { key: 'guests', icon: UsersIcon, tone: 'wait', value: shown.guestCount, label: t('guestSchedule.checkIn.registeredGuests') },
            { key: 'start', icon: CalendarIcon, tone: 'ok', value: formatDayMonth(start), label: t('guestSchedule.detail.start') },
            { key: 'end', icon: CalendarCheckIcon, tone: 'off', value: formatDayMonth(end), label: t('guestSchedule.detail.end') },
          ]}
        />
        {shown.host ? <DetailRow icon={BuildingIcon} label={t('guestSchedule.detail.host')} value={shown.host} /> : null}
        {extra?.checkIn ? <DetailRow icon={ShieldCheckIcon} label={t('guestSchedule.detail.checkedInAt')} value={gateRecord(extra.checkIn)} /> : null}
        {extra?.checkOut ? <DetailRow icon={LogOutIcon} label={t('guestSchedule.detail.checkedOutAt')} value={gateRecord(extra.checkOut)} /> : null}
      </View>

      {extra?.status === 'checkedIn' && !extra.canCheckOut ? (
        <Banner testID="guests-visit-sheet-wait-reception" tone="warning">
          {t('guestSchedule.view.waitReception')}
        </Banner>
      ) : null}

      {failed ? (
        <View className="flex-row items-center gap-2">
          <Text className="min-w-0 flex-1 text-muted" style={{ fontSize: 13, lineHeight: 18 }}>
            {t('guestSchedule.detail.loadFailed')}
          </Text>
          <Pressable testID="guests-visit-sheet-retry" accessibilityRole="button" hitSlop={8} onPress={() => void details.refetch()} className="active:opacity-70">
            <Text weight="semibold" className="text-primary" style={{ fontSize: 13.5, lineHeight: 18 }}>
              {t('common.retry')}
            </Text>
          </Pressable>
        </View>
      ) : null}

      {details.isLoading ? (
        <View className="gap-3">
          <Skeleton width="40%" height={16} />
          <Skeleton width="70%" height={14} />
          <Skeleton width="60%" height={14} />
        </View>
      ) : extra?.members.length ? (
        <View testID="guests-visit-sheet-members">
          <SectionTitle right={t('guestSchedule.detail.membersCount', { count: extra.members.length })} className="mb-1">
            {t('guestSchedule.detail.members')}
          </SectionTitle>
          {extra.members.map((member, index) => (
            <View key={member.id || index} className={cn('flex-row items-center gap-3 py-2.5', index > 0 && 'border-t border-line-2')}>
              <Avatar name={member.name} size={32} />
              <Text numberOfLines={2} className="min-w-0 flex-1 text-ink" style={{ fontSize: 14.5, lineHeight: 20 }}>
                {member.name}
              </Text>
            </View>
          ))}
        </View>
      ) : null}
    </BottomSheet>
  );
}

/** Icon, a muted label, then the value over as many lines as it needs (long unit names). */
function DetailRow({ icon, label, value }: { icon: AppIcon; label: string; value: string }) {
  return (
    <View className="flex-row gap-2.5 border-t border-line-2 px-3.5 py-3">
      <View className="pt-px">
        <Icon icon={icon} size={16} color="primary" />
      </View>
      <View className="min-w-0 flex-1 gap-0.5">
        <Text className="text-muted" style={{ fontSize: 12, lineHeight: 16 }}>
          {label}
        </Text>
        <Text className="text-ink" style={{ fontSize: 14, lineHeight: 20 }}>
          {value}
        </Text>
      </View>
    </View>
  );
}
