import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { qk } from '@/core/query/keys';
import { atMinutes, formatDate, formatDayMonth, formatKey, formatTime, minutesOfDay, parseServerDate, toDateKey } from '@/core/time/vn';
import { cn } from '@/shared/lib/cn';
import { goBack } from '@/shared/lib/navigation';
import { Avatar } from '@/shared/ui/Avatar';
import { Banner } from '@/shared/ui/Banner';
import { Button } from '@/shared/ui/Button';
import { Card, FloatingCard } from '@/shared/ui/Card';
import { DatePickerSheet } from '@/shared/ui/DatePickerSheet';
import { HeaderPill, useHeaderDot } from '@/shared/ui/HeaderPill';
import { Icon } from '@/shared/ui/Icon';
import {
  type AppIcon,
  CalendarCheckIcon,
  CalendarIcon,
  ClockIcon,
  LogOutIcon,
  MapPinIcon,
  PencilIcon,
  RotateCcwIcon,
  ScanQrCodeIcon,
  ShieldCheckIcon,
  UsersIcon,
} from '@/shared/ui/icons';
import { ModuleHeader } from '@/shared/ui/ModuleHeader';
import { ModuleScreen } from '@/shared/ui/ModuleScreen';
import { NoteField } from '@/shared/ui/NoteField';
import { NumberStepper } from '@/shared/ui/NumberStepper';
import { useHeaderColors } from '@/shared/ui/ScreenShell';
import { Skeleton } from '@/shared/ui/Skeleton';
import { SectionTitle } from '@/shared/ui/SectionTitle';
import { type StatItem, StatStrip } from '@/shared/ui/StatStrip';
import { type BadgeKind, StatusBadge } from '@/shared/ui/StatusBadge';
import { Text } from '@/shared/ui/Text';
import { TimePickerSheet } from '@/shared/ui/TimePickerSheet';
import { toast } from '@/shared/ui/Toast';

import { guestApi } from '../api/guest.api';
import { ScanErrorScreen } from '../components/ScanErrorScreen';
import { type GateInput, GuestError, type GateRecord, type GuestMember, type GuestVisit } from '../types';
import { guestErrorMessage } from '../utils/errors';
import { checkOutBlocker, type GateMode, gateModeOf, isOfficeHours, type ReceptionTally, receptionTally, visitPhase } from '../utils/visit';

const NOTE_MAX = 500;

/** A gate step the guard confirms. */
type GateStep = 'in' | 'out';

/** The words of each step's form. */
const copy = {
  in: {
    at: 'guestSchedule.checkIn.checkInAt',
    chooseDate: 'guestSchedule.checkIn.chooseDate',
    chooseTime: 'guestSchedule.checkIn.chooseTime',
    count: 'guestSchedule.checkIn.actualCount',
    match: 'guestSchedule.checkIn.countMatch',
    more: 'guestSchedule.checkIn.countMore',
    less: 'guestSchedule.checkIn.countLess',
    submit: 'guestSchedule.checkIn.submit',
  },
  out: {
    at: 'guestSchedule.checkOut.checkOutAt',
    chooseDate: 'guestSchedule.checkOut.chooseDate',
    chooseTime: 'guestSchedule.checkOut.chooseTime',
    count: 'guestSchedule.checkOut.actualCount',
    match: 'guestSchedule.checkOut.countMatch',
    more: 'guestSchedule.checkOut.countMore',
    less: 'guestSchedule.checkOut.countLess',
    submit: 'guestSchedule.checkOut.submit',
  },
} as const;

const titles: Record<GateMode, 'guestSchedule.checkIn.title' | 'guestSchedule.checkOut.title' | 'guestSchedule.view.title'> = {
  in: 'guestSchedule.checkIn.title',
  out: 'guestSchedule.checkOut.title',
  view: 'guestSchedule.view.title',
};

/** "HH:mm dd/MM" of a gate record's time. */
const whenOf = (record: GateRecord) => {
  const at = parseServerDate(record.at);
  return at ? `${formatTime(at)} ${formatDayMonth(at)}` : '';
};

/**
 * What a scanned guest QR (or a visit opened from the list) leads to, by where the group stands at the gate:
 * "Xác nhận vào cổng" while it waits outside, "Xác nhận ra cổng" while it is in and may leave now, otherwise the group
 * shown read-only with why (gone and the code spent, inside but reception has not checked anyone in during office
 * hours, or turned away). Once reception has checked every guest out, leaving is only a check of the list and one tap,
 * with the full form a tap away. The group sits on the blue header, its registration in a card over it.
 */
export function GuestCheckInScreen() {
  const { t } = useTranslation();
  const { qr = '' } = useLocalSearchParams<{ qr?: string }>();
  const visit = useQuery({ queryKey: qk.guests.visit(qr), queryFn: () => guestApi.lookup(qr), retry: false });
  const [detailed, setDetailed] = useState(false);
  const data = visit.data;
  const mode = data ? gateModeOf(data) : 'in';
  const tally = receptionTally(data?.members ?? []);

  const header = (
    <ModuleHeader
      testID="guest-check-in-header"
      icon={mode === 'out' ? LogOutIcon : ShieldCheckIcon}
      title={t(titles[mode])}
      subtitle={data?.code}
      subtitleMono
      bottom={18}
    >
      {data ? <VisitHeader visit={data} mode={mode} /> : null}
    </ModuleHeader>
  );

  if (data) {
    return mode === 'view' ? (
      <GateView visit={data} header={header} refreshing={visit.isFetching} onRefresh={() => void visit.refetch()} />
    ) : mode === 'out' && tally.done && !detailed ? (
      <ReleaseView visit={data} tally={tally} qr={qr} header={header} onDetails={() => setDetailed(true)} />
    ) : (
      // Keyed by the step, so a form switched under the guard starts afresh.
      <GateForm key={mode} step={mode} visit={data} qr={qr} header={header} />
    );
  }
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

/**
 * A pill, then the group in large type. Before entry the pill says where today falls in the visit; after, where the
 * group stands at the gate (in since when, gone, or turned away).
 */
function VisitHeader({ visit, mode }: { visit: GuestVisit; mode: GateMode }) {
  const { t } = useTranslation();
  const { fg } = useHeaderColors();
  const phase = visitPhase(visit);
  const atGate = visit.status === 'checkedIn' ? 'ok' : visit.status === 'rejected' ? 'danger' : 'off';
  const dot = useHeaderDot(mode === 'in' ? (phase.kind === 'ongoing' ? 'ok' : phase.kind === 'upcoming' ? 'warn' : 'danger') : atGate);
  const label =
    mode === 'in'
      ? phase.kind === 'ongoing'
        ? t('guestSchedule.checkIn.phaseOngoing', { day: phase.day, days: phase.days })
        : t(phase.kind === 'upcoming' ? 'guestSchedule.checkIn.phaseUpcoming' : 'guestSchedule.checkIn.phaseEnded')
      : visit.status === 'checkedIn' && visit.checkIn
        ? t('guestSchedule.checkOut.inSince', { time: whenOf(visit.checkIn) })
        : t(`guestSchedule.dashboard.status.${visit.status}`);
  return (
    <View className="gap-2">
      <View className="flex-row">
        <HeaderPill testID="guest-check-in-phase" label={label} dotColor={dot} />
      </View>
      <Text weight="bold" numberOfLines={2} accessibilityRole="header" style={{ fontSize: 24, lineHeight: 30, letterSpacing: -0.3, color: fg }}>
        {visit.groupName}
      </Text>
    </View>
  );
}

/**
 * The registration over the header: registered guests, the period (coloured by where today falls in it), the place.
 * `stats` replaces the first row (the head counts when letting the group out).
 */
function RegistrationCard({ visit, stats }: { visit: GuestVisit; stats?: StatItem[] }) {
  const { t } = useTranslation();
  const now = new Date();
  const phase = visitPhase(visit, now);
  const fromKey = toDateKey(parseServerDate(visit.fromDate) ?? now);
  const toKey = toDateKey(parseServerDate(visit.toDate) ?? now);
  return (
    <FloatingCard radius={20} testID="guest-check-in-visit">
      <StatStrip
        items={
          stats ?? [
            { key: 'guests', icon: UsersIcon, tone: 'wait', value: visit.guestCount, label: t('guestSchedule.checkIn.registeredGuests') },
            { key: 'from', icon: CalendarIcon, tone: phase.kind === 'upcoming' ? 'warn' : 'ok', value: formatKey(fromKey, false), label: t('guestSchedule.checkIn.fromDate') },
            { key: 'to', icon: CalendarCheckIcon, tone: phase.kind === 'ended' ? 'danger' : 'off', value: formatKey(toKey, false), label: t('guestSchedule.checkIn.toDate') },
          ]
        }
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
}

/**
 * Posts a gate step, then leads to the success screen. `canCheckOut` holds only when read, so going out reads the group
 * again first.
 */
function useGateStep(step: GateStep, visit: GuestVisit, qr: string) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: GateInput) => {
      if (step === 'in') return guestApi.checkIn(input, visit);
      const fresh = await guestApi.lookup(qr);
      if (!fresh.canCheckOut) throw new GuestError(checkOutBlocker(fresh));
      return guestApi.checkOut(input, fresh);
    },
    onSuccess: (done) => {
      // The group has moved tab on the dashboard and the list, and its code now leads elsewhere.
      void queryClient.invalidateQueries({ queryKey: qk.guests.root });
      router.replace({
        pathname: '/guests/success',
        params: { kind: step, name: done.visit.groupName, at: done.at, count: String(done.actualGuestCount), location: done.visit.location ?? '' },
      });
    },
    onError: (e) => {
      toast.error(guestErrorMessage(e, t));
      // The group's gate state changed under the guard: read it again, so the screen shows what it allows now.
      if (e instanceof GuestError) void queryClient.invalidateQueries({ queryKey: qk.guests.visit(qr) });
    },
  });
}

/**
 * The guard's form for a gate step: time, head count (against the registration going in, against the count that went
 * in going out) and a note. Going in it warns outside the visit period. Going out it lists the guests with where
 * reception has them. Outside office hours the guard stands in for reception, and the server checks out of reception
 * whoever reception has not, which it says; during them it warns while reception has not checked everyone out (the
 * group leaves only once). Once reception has, the count starts at reception's.
 */
function GateForm({ step, visit, qr, header }: { step: GateStep; visit: GuestVisit; qr: string; header: ReactNode }) {
  const { t } = useTranslation();
  const words = copy[step];
  const tally = receptionTally(visit.members);
  const base = step === 'in' ? visit.guestCount : (visit.checkIn?.count ?? visit.guestCount);
  const [at, setAt] = useState(() => new Date());
  const [count, setCount] = useState(step === 'out' && tally.done ? tally.checkedOut : base);
  const [note, setNote] = useState('');
  const [picker, setPicker] = useState<'date' | 'time' | null>(null);
  const dayKey = toDateKey(at);
  const phase = visitPhase(visit);
  const diff = count - base;
  const submit = useGateStep(step, visit, qr);

  const outOfPeriod = step === 'in' && phase.kind !== 'ongoing';
  const now = new Date();
  const fromKey = toDateKey(parseServerDate(visit.fromDate) ?? now);
  const toKey = toDateKey(parseServerDate(visit.toDate) ?? now);

  return (
    <ModuleScreen
      header={header}
      floating={<RegistrationCard visit={visit} />}
      floatingScrolls
      footer={
        <>
          <Button testID="guest-check-in-cancel" className="flex-1" variant="ghost" label={t('common.cancel')} onPress={() => goBack('/guests/scan')} />
          <Button
            testID="guest-check-in-submit"
            className="flex-[1.7]"
            icon={step === 'in' ? ShieldCheckIcon : LogOutIcon}
            label={t(words.submit)}
            loading={submit.isPending}
            onPress={() => submit.mutate({ at: at.toISOString(), actualGuestCount: count, note: note.trim() || undefined })}
          />
        </>
      }
    >
      {outOfPeriod ? (
        <Banner testID="guest-check-in-out-of-period" tone="warning">
          {phase.kind === 'upcoming'
            ? t('guestSchedule.checkIn.upcomingWarning', { date: formatKey(fromKey) })
            : t('guestSchedule.checkIn.endedWarning', { date: formatKey(toKey) })}
        </Banner>
      ) : null}
      {step === 'out' && !isOfficeHours(now) ? (
        <Banner testID="guest-check-out-after-hours" tone="info">
          {tally.expected > tally.checkedOut
            ? t('guestSchedule.checkOut.afterHoursRest', { count: tally.expected - tally.checkedOut })
            : t('guestSchedule.checkOut.afterHours')}
        </Banner>
      ) : step === 'out' && tally.expected > 0 && !tally.done ? (
        <Banner testID="guest-check-out-reception-partial" tone="warning">
          {t('guestSchedule.checkOut.receptionPartial', { left: tally.checkedOut, expected: tally.expected })}
        </Banner>
      ) : null}

      <Card>
        <Section label={t(words.at)} required>
          <View className="flex-row gap-2.5">
            <PickerTile testID="guest-check-in-date" icon={CalendarIcon} label={t('guestSchedule.checkIn.date')} value={formatDate(at)} onPress={() => setPicker('date')} />
            <PickerTile testID="guest-check-in-time" icon={ClockIcon} label={t('guestSchedule.checkIn.time')} value={formatTime(at)} onPress={() => setPicker('time')} />
          </View>
        </Section>

        <View className="flex-row items-center gap-3 border-t border-line-2 p-4">
          <View className="min-w-0 flex-1 gap-1.5">
            <FieldLabel label={t(words.count)} />
            <StatusBadge
              testID="guest-check-in-count-diff"
              kind={diff === 0 ? 'ok' : diff > 0 ? 'warn' : 'wait'}
              label={diff === 0 ? t(words.match) : t(diff > 0 ? words.more : words.less, { count: Math.abs(diff) })}
            />
          </View>
          <NumberStepper testID="guest-check-in-count" accessibilityLabel={t(words.count)} size="lg" value={count} onChange={setCount} min={1} warn={diff > 0} />
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

      {step === 'out' && visit.members.length ? <MemberList members={visit.members} tally={tally} /> : null}

      <DatePickerSheet
        visible={picker === 'date'}
        onClose={() => setPicker(null)}
        title={t(words.chooseDate)}
        value={dayKey}
        onSelect={(key) => setAt(atMinutes(key, minutesOfDay(at)))}
      />
      <TimePickerSheet
        testID="guest-check-in-time-sheet"
        visible={picker === 'time'}
        onClose={() => setPicker(null)}
        title={t(words.chooseTime)}
        value={minutesOfDay(at)}
        extraLabel={t('guestSchedule.checkIn.now')}
        onExtra={() => setAt(new Date())}
        onSelect={(minutes) => setAt(atMinutes(dayKey, minutes))}
      />
    </ModuleScreen>
  );
}

/**
 * Leaving once reception has checked every expected guest out: the guard only checks the group against the list and
 * lets it out in one tap, now and as many as reception checked out. The head counts replace the period on the card,
 * and a count other than the one that came in is flagged. The full form stays a tap away for a note or another count.
 */
function ReleaseView({ visit, tally, qr, header, onDetails }: { visit: GuestVisit; tally: ReceptionTally; qr: string; header: ReactNode; onDetails: () => void }) {
  const { t } = useTranslation();
  const submit = useGateStep('out', visit, qr);
  const entered = visit.checkIn?.count ?? null;
  const mismatch = entered !== null && entered !== tally.checkedOut;

  return (
    <ModuleScreen
      header={header}
      floating={
        <RegistrationCard
          visit={visit}
          stats={[
            { key: 'entered', icon: ShieldCheckIcon, tone: 'wait', value: entered ?? '–', label: t('guestSchedule.release.entered') },
            { key: 'left', icon: LogOutIcon, tone: mismatch ? 'warn' : 'ok', value: tally.checkedOut, label: t('guestSchedule.release.receptionOut') },
            { key: 'registered', icon: UsersIcon, tone: 'off', value: visit.guestCount, label: t('guestSchedule.release.registered') },
          ]}
        />
      }
      floatingScrolls
      footer={
        <>
          <Button testID="guest-release-cancel" className="flex-1" variant="ghost" label={t('common.cancel')} onPress={() => goBack('/guests/scan')} />
          <Button
            testID="guest-release-submit"
            className="flex-[1.7]"
            icon={LogOutIcon}
            label={t('guestSchedule.release.submit')}
            loading={submit.isPending}
            onPress={() => submit.mutate({ at: new Date().toISOString(), actualGuestCount: tally.checkedOut })}
          />
        </>
      }
    >
      <Banner testID="guest-release-ready" tone="success">
        {t('guestSchedule.release.ready', { count: tally.checkedOut })}
      </Banner>
      {mismatch ? (
        <Banner testID="guest-release-mismatch" tone="warning">
          {t('guestSchedule.release.countMismatch', { entered, left: tally.checkedOut })}
        </Banner>
      ) : null}

      <MemberList members={visit.members} tally={tally} />

      <Pressable
        testID="guest-release-details"
        accessibilityRole="button"
        onPress={onDetails}
        hitSlop={8}
        className="flex-row items-center gap-1.5 self-center py-1.5 active:opacity-70"
      >
        <Icon icon={PencilIcon} size={15} color="primary" />
        <Text weight="semibold" className="text-primary" style={{ fontSize: 14, lineHeight: 19 }}>
          {t('guestSchedule.release.details')}
        </Text>
      </Pressable>
    </ModuleScreen>
  );
}

/** The guests to check at the gate, with how many reception has checked out of those it expects. */
function MemberList({ members, tally }: { members: GuestMember[]; tally: ReceptionTally }) {
  const { t } = useTranslation();
  return (
    <Card testID="guest-gate-members">
      <View className="px-4 pt-3.5">
        <SectionTitle right={t('guestSchedule.members.progress', { left: tally.checkedOut, expected: tally.expected })}>{t('guestSchedule.members.title')}</SectionTitle>
      </View>
      {members.map((member, index) => (
        <MemberRow key={member.id || index} member={member} divider={index > 0} />
      ))}
    </Card>
  );
}

/** A guest: name, then position, ID number and whether added on the day; on the right where reception has them. */
function MemberRow({ member, divider }: { member: GuestMember; divider: boolean }) {
  const { t } = useTranslation();
  const out = parseServerDate(member.receptionOut);
  const badge: { kind: BadgeKind; label: string } = member.absent
    ? { kind: 'off', label: t('guestSchedule.members.absent') }
    : out
      ? { kind: 'ok', label: t('guestSchedule.members.left', { time: formatTime(out) }) }
      : member.receptionIn
        ? { kind: 'warn', label: t('guestSchedule.members.inside') }
        : { kind: 'off', label: t('guestSchedule.members.notIn') };
  const meta = [
    member.position,
    member.identityNumber ? t('guestSchedule.members.identity', { number: member.identityNumber }) : null,
    member.extra ? t('guestSchedule.members.extra') : null,
  ]
    .filter(Boolean)
    .join(' · ');
  return (
    <View testID={`guest-gate-member-${member.id}`} className={cn('flex-row items-center gap-3 px-4 py-2.5', divider && 'border-t border-line-2')}>
      <Avatar name={member.name} size={32} />
      <View className="min-w-0 flex-1 gap-0.5">
        <Text weight="semibold" numberOfLines={2} className={member.absent ? 'text-muted' : 'text-ink'} style={{ fontSize: 14.5, lineHeight: 20 }}>
          {member.name}
        </Text>
        {meta ? (
          <Text numberOfLines={2} className="text-muted" style={{ fontSize: 12.5, lineHeight: 17 }}>
            {meta}
          </Text>
        ) : null}
      </View>
      <StatusBadge kind={badge.kind} label={badge.label} />
    </View>
  );
}

/**
 * The group read-only: why nothing can be done at the gate now, then its gate log (in and out, with head count and
 * note). Inside during office hours it can be checked again once reception has checked someone in; otherwise the
 * guard moves on to another code.
 */
function GateView({ visit, header, refreshing, onRefresh }: { visit: GuestVisit; header: ReactNode; refreshing: boolean; onRefresh: () => void }) {
  const { t } = useTranslation();
  const waiting = visit.status === 'checkedIn';
  const notice =
    visit.status === 'checkedOut'
      ? { tone: 'info' as const, text: t('guestSchedule.view.checkedOut') }
      : visit.status === 'rejected'
        ? { tone: 'danger' as const, text: t('guestSchedule.view.rejected') }
        : { tone: 'warning' as const, text: t('guestSchedule.view.waitReception') };
  const rescan = () => router.replace('/guests/scan');

  return (
    <ModuleScreen
      header={header}
      floating={<RegistrationCard visit={visit} />}
      floatingScrolls
      footer={
        waiting ? (
          <>
            <Button testID="guest-view-rescan" className="flex-1" variant="ghost" label={t('guestSchedule.view.rescan')} onPress={rescan} />
            <Button testID="guest-view-refresh" className="flex-[1.4]" icon={RotateCcwIcon} label={t('guestSchedule.view.refresh')} loading={refreshing} onPress={onRefresh} />
          </>
        ) : (
          <>
            <Button testID="guest-view-close" className="flex-1" variant="ghost" label={t('common.close')} onPress={() => goBack('/guests')} />
            <Button testID="guest-view-rescan" className="flex-[1.4]" icon={ScanQrCodeIcon} label={t('guestSchedule.view.rescan')} onPress={rescan} />
          </>
        )
      }
    >
      <Banner testID={`guest-view-${visit.status}`} tone={notice.tone}>
        {notice.text}
      </Banner>

      {visit.checkIn || visit.checkOut ? (
        <Card testID="guest-view-gate-log">
          <View className="px-4 pt-3.5">
            <SectionTitle>{t('guestSchedule.view.gateLog')}</SectionTitle>
          </View>
          {visit.checkIn ? <GateLogRow icon={ShieldCheckIcon} label={t('guestSchedule.view.entered')} record={visit.checkIn} /> : null}
          {visit.checkOut ? <GateLogRow icon={LogOutIcon} label={t('guestSchedule.view.left')} record={visit.checkOut} divider={!!visit.checkIn} /> : null}
        </Card>
      ) : null}
    </ModuleScreen>
  );
}

/** One pass of the gate: what it was and when, the head count, and the note under it. */
function GateLogRow({ icon, label, record, divider }: { icon: AppIcon; label: string; record: GateRecord; divider?: boolean }) {
  const { t } = useTranslation();
  return (
    <View className={cn('flex-row gap-3 px-4 py-3', divider && 'border-t border-line-2')}>
      <View className="pt-0.5">
        <Icon icon={icon} size={18} color="primary" />
      </View>
      <View className="min-w-0 flex-1 gap-0.5">
        <View className="flex-row items-center justify-between gap-2">
          <Text weight="semibold" className="text-ink" style={{ fontSize: 14.5, lineHeight: 20 }}>
            {label}
          </Text>
          <Text numeric className="text-ink-2" style={{ fontSize: 14, lineHeight: 20 }}>
            {whenOf(record)}
          </Text>
        </View>
        {record.count !== null ? (
          <Text className="text-muted" style={{ fontSize: 13, lineHeight: 18 }}>
            {t('guestSchedule.view.guests', { count: record.count })}
          </Text>
        ) : null}
        {record.note ? (
          <Text className="text-muted" style={{ fontSize: 13, lineHeight: 18 }}>
            {record.note}
          </Text>
        ) : null}
      </View>
    </View>
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

/** Filled tile that opens a picker: glyph, small caption, value (date / time). */
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
