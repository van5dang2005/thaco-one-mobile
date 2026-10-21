import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { qk } from '@/core/query/keys';
import { atMinutes, formatDate, formatKey, formatTime, minutesOfDay, parseServerDate, toDateKey } from '@/core/time/vn';
import { goBack } from '@/shared/lib/navigation';
import { Banner } from '@/shared/ui/Banner';
import { Button } from '@/shared/ui/Button';
import { Card, FloatingCard } from '@/shared/ui/Card';
import { DatePickerSheet } from '@/shared/ui/DatePickerSheet';
import { HeaderPill, useHeaderDot } from '@/shared/ui/HeaderPill';
import { Icon } from '@/shared/ui/Icon';
import { type AppIcon, CalendarCheckIcon, CalendarIcon, ClockIcon, MapPinIcon, ShieldCheckIcon, UsersIcon } from '@/shared/ui/icons';
import { ModuleHeader } from '@/shared/ui/ModuleHeader';
import { ModuleScreen } from '@/shared/ui/ModuleScreen';
import { NoteField } from '@/shared/ui/NoteField';
import { NumberStepper } from '@/shared/ui/NumberStepper';
import { useHeaderColors } from '@/shared/ui/ScreenShell';
import { Skeleton } from '@/shared/ui/Skeleton';
import { StatStrip } from '@/shared/ui/StatStrip';
import { StatusBadge } from '@/shared/ui/StatusBadge';
import { Text } from '@/shared/ui/Text';
import { TimePickerSheet } from '@/shared/ui/TimePickerSheet';
import { toast } from '@/shared/ui/Toast';

import { guestApi } from '../api/guest.api';
import { ScanErrorScreen } from '../components/ScanErrorScreen';
import type { GuestVisit } from '../types';
import { guestErrorMessage } from '../utils/errors';
import { visitPhase } from '../utils/visit';

const NOTE_MAX = 500;

/**
 * "Xác nhận vào cổng" (guest check-in, step 2): the group on the blue header with where today falls in its visit,
 * the registration over it (guests, period, place), then time in, head count and the guard's note.
 */
export function GuestCheckInScreen() {
  const { t } = useTranslation();
  const { qr = '' } = useLocalSearchParams<{ qr?: string }>();
  const visit = useQuery({ queryKey: qk.guests.visit(qr), queryFn: () => guestApi.lookup(qr), retry: false });
  const data = visit.data;

  const header = (
    <ModuleHeader
      testID="guest-check-in-header"
      icon={ShieldCheckIcon}
      title={t('guestSchedule.checkIn.title')}
      subtitle={data?.code}
      subtitleMono
      bottom={18}
    >
      {data ? <VisitHeader visit={data} /> : null}
    </ModuleHeader>
  );

  if (data) return <CheckInForm visit={data} header={header} />;
  if (visit.isError) {
    return <ScanErrorScreen header={header} error={visit.error} qr={qr} retrying={visit.isFetching} onRetry={() => void visit.refetch()} />;
  }
  return (
    <ModuleScreen header={header} floating={<LookupCard />} floatingScrolls>
      {null}
    </ModuleScreen>
  );
}

/** Where the result card will be while the code is checked. */
function LookupCard() {
  const { t } = useTranslation();
  return (
    <FloatingCard radius={20} className="items-center gap-3 px-5 pb-6 pt-6" testID="guest-check-in-loading">
      <Skeleton width={84} height={84} radius={42} />
      <Skeleton width="55%" height={18} />
      <Text className="text-muted" style={{ fontSize: 13.5, lineHeight: 18 }}>
        {t('guestSchedule.scanError.checking')}
      </Text>
    </FloatingCard>
  );
}

/** Status pill (in / before / after the visit period), the group in large type, the purpose under it. */
function VisitHeader({ visit }: { visit: GuestVisit }) {
  const { t } = useTranslation();
  const { fg, text2 } = useHeaderColors();
  const phase = visitPhase(visit);
  const dot = useHeaderDot(phase.kind === 'ongoing' ? 'ok' : phase.kind === 'upcoming' ? 'warn' : 'danger');
  const label =
    phase.kind === 'ongoing'
      ? t('guestSchedule.checkIn.phaseOngoing', { day: phase.day, days: phase.days })
      : t(phase.kind === 'upcoming' ? 'guestSchedule.checkIn.phaseUpcoming' : 'guestSchedule.checkIn.phaseEnded');
  return (
    <View className="gap-2">
      <View className="flex-row">
        <HeaderPill testID="guest-check-in-phase" label={label} dotColor={dot} />
      </View>
      <Text weight="bold" numberOfLines={2} accessibilityRole="header" style={{ fontSize: 24, lineHeight: 30, letterSpacing: -0.3, color: fg }}>
        {visit.groupName}
      </Text>
      {visit.purpose ? (
        <Text numberOfLines={2} style={{ fontSize: 13.5, lineHeight: 19, color: text2 }}>
          {visit.purpose}
        </Text>
      ) : null}
    </View>
  );
}

function CheckInForm({ visit, header }: { visit: GuestVisit; header: ReactNode }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [checkInAt, setCheckInAt] = useState(() => new Date());
  const [count, setCount] = useState(visit.guestCount);
  const [note, setNote] = useState('');
  const [picker, setPicker] = useState<'date' | 'time' | null>(null);
  const dayKey = toDateKey(checkInAt);
  const phase = visitPhase(visit);
  const fromKey = toDateKey(parseServerDate(visit.fromDate) ?? checkInAt);
  const toKey = toDateKey(parseServerDate(visit.toDate) ?? checkInAt);
  const diff = count - visit.guestCount;

  const submit = useMutation({
    mutationFn: () =>
      guestApi.checkIn({ checkInAt: checkInAt.toISOString(), actualGuestCount: count, note: note.trim() || undefined }, visit),
    onSuccess: (done) => {
      // The group has moved tab on the dashboard and the list.
      void queryClient.invalidateQueries({ queryKey: qk.guests.schedulesRoot });
      router.replace({
        pathname: '/guests/success',
        params: { name: done.visit.groupName, at: done.checkInAt, count: String(done.actualGuestCount), location: done.visit.location ?? '' },
      });
    },
    onError: (e) => toast.error(guestErrorMessage(e, t)),
  });

  const registration = (
    <FloatingCard radius={20} testID="guest-check-in-visit">
      <StatStrip
        items={[
          { key: 'guests', icon: UsersIcon, tone: 'wait', value: visit.guestCount, label: t('guestSchedule.checkIn.registeredGuests') },
          { key: 'from', icon: CalendarIcon, tone: phase.kind === 'upcoming' ? 'warn' : 'ok', value: formatKey(fromKey, false), label: t('guestSchedule.checkIn.fromDate') },
          { key: 'to', icon: CalendarCheckIcon, tone: phase.kind === 'ended' ? 'danger' : 'off', value: formatKey(toKey, false), label: t('guestSchedule.checkIn.toDate') },
        ]}
      />
      {visit.location ? (
        <View className="flex-row items-center gap-2.5 border-t border-line-2 px-3.5 py-3">
          <Icon icon={MapPinIcon} size={16} color="primary" />
          <Text numberOfLines={2} className="min-w-0 flex-1 text-ink-2" style={{ fontSize: 13.5, lineHeight: 18 }}>
            {visit.location}
          </Text>
        </View>
      ) : null}
    </FloatingCard>
  );

  return (
    <ModuleScreen
      header={header}
      floating={registration}
      floatingScrolls
      footer={
        <>
          <Button testID="guest-check-in-cancel" className="flex-1" variant="ghost" label={t('common.cancel')} onPress={() => goBack('/guests/scan')} />
          <Button
            testID="guest-check-in-submit"
            className="flex-[1.7]"
            icon={ShieldCheckIcon}
            label={t('guestSchedule.checkIn.submit')}
            loading={submit.isPending}
            onPress={() => submit.mutate()}
          />
        </>
      }
    >
      {phase.kind !== 'ongoing' ? (
        <Banner testID="guest-check-in-out-of-period" tone="warning">
          {phase.kind === 'upcoming'
            ? t('guestSchedule.checkIn.upcomingWarning', { date: formatKey(fromKey) })
            : t('guestSchedule.checkIn.endedWarning', { date: formatKey(toKey) })}
        </Banner>
      ) : null}

      <Card>
        <Section label={t('guestSchedule.checkIn.checkInAt')} required>
          <View className="flex-row gap-2.5">
            <PickerTile testID="guest-check-in-date" icon={CalendarIcon} label={t('guestSchedule.checkIn.date')} value={formatDate(checkInAt)} onPress={() => setPicker('date')} />
            <PickerTile testID="guest-check-in-time" icon={ClockIcon} label={t('guestSchedule.checkIn.time')} value={formatTime(checkInAt)} onPress={() => setPicker('time')} />
          </View>
        </Section>

        <View className="flex-row items-center gap-3 border-t border-line-2 p-4">
          <View className="min-w-0 flex-1 gap-1.5">
            <FieldLabel label={t('guestSchedule.checkIn.actualCount')} />
            <StatusBadge
              testID="guest-check-in-count-diff"
              kind={diff === 0 ? 'ok' : diff > 0 ? 'warn' : 'wait'}
              label={
                diff === 0
                  ? t('guestSchedule.checkIn.countMatch')
                  : t(diff > 0 ? 'guestSchedule.checkIn.countMore' : 'guestSchedule.checkIn.countLess', { count: Math.abs(diff) })
              }
            />
          </View>
          <NumberStepper
            testID="guest-check-in-count"
            accessibilityLabel={t('guestSchedule.checkIn.actualCount')}
            size="lg"
            value={count}
            onChange={setCount}
            min={1}
            warn={diff > 0}
          />
        </View>

        <Section className="border-t border-line-2" label={t('guestSchedule.checkIn.note')} right={`${note.length}/${NOTE_MAX}`}>
          <NoteField
            testID="guest-check-in-note"
            value={note}
            onChangeText={setNote}
            maxLength={NOTE_MAX}
            placeholder={t('guestSchedule.checkIn.notePlaceholder')}
            numberOfLines={4}
          />
        </Section>
      </Card>

      <DatePickerSheet
        visible={picker === 'date'}
        onClose={() => setPicker(null)}
        title={t('guestSchedule.checkIn.chooseDate')}
        value={dayKey}
        onSelect={(key) => setCheckInAt(atMinutes(key, minutesOfDay(checkInAt)))}
      />
      <TimePickerSheet
        testID="guest-check-in-time-sheet"
        visible={picker === 'time'}
        onClose={() => setPicker(null)}
        title={t('guestSchedule.checkIn.chooseTime')}
        value={minutesOfDay(checkInAt)}
        extraLabel={t('guestSchedule.checkIn.now')}
        onExtra={() => setCheckInAt(new Date())}
        onSelect={(minutes) => setCheckInAt(atMinutes(dayKey, minutes))}
      />
    </ModuleScreen>
  );
}

/** A block of the form card: label (+ right-hand note) above its control. */
function Section({ label, required, right, className, children }: { label: string; required?: boolean; right?: string; className?: string; children: ReactNode }) {
  return (
    <View className={className}>
      <View className="gap-2.5 p-4">
        <View className="flex-row items-center justify-between gap-2">
          <FieldLabel label={label} required={required} />
          {right ? (
            <Text numeric className="text-meta text-subtle">
              {right}
            </Text>
          ) : null}
        </View>
        {children}
      </View>
    </View>
  );
}

function FieldLabel({ label, required }: { label: string; required?: boolean }) {
  return (
    <Text weight="semibold" numberOfLines={1} className="flex-shrink text-ink" style={{ fontSize: 14, lineHeight: 19 }}>
      {label}
      {required ? <Text weight="semibold" className="text-danger">{' *'}</Text> : null}
    </Text>
  );
}

/** Filled tile that opens a picker: glyph, small caption, value (date / time in). */
function PickerTile({ icon, label, value, onPress, testID }: { icon: AppIcon; label: string; value: string; onPress: () => void; testID: string }) {
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={`${label} ${value}`}
      onPress={onPress}
      className="min-h-[56px] min-w-0 flex-1 flex-row items-center gap-2.5 rounded-button bg-field px-3 py-2 active:opacity-70"
    >
      <Icon icon={icon} size={18} color="primary" />
      <View className="min-w-0 flex-1">
        <Text numberOfLines={1} className="text-meta text-muted">
          {label}
        </Text>
        <Text numeric weight="semibold" numberOfLines={1} style={{ fontSize: 16, lineHeight: 21 }}>
          {value}
        </Text>
      </View>
    </Pressable>
  );
}
