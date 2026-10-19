import { useMutation, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, RefreshControl, View } from 'react-native';

import { errorMessage } from '@/core/errors/errorMessage';
import { qk } from '@/core/query/keys';
import { useCapabilities } from '@/core/session/capabilities';
import { useParcelMe } from '@/core/session/useMe';
import { sameId } from '@/core/session/userTypes';
import { useTheme } from '@/core/theme/ThemeProvider';
import { formatDate, formatKey, formatTime, parseServerDate } from '@/core/time/vn';
import { goBack } from '@/shared/lib/navigation';
import { Avatar } from '@/shared/ui/Avatar';
import { Banner } from '@/shared/ui/Banner';
import { BottomSheet } from '@/shared/ui/BottomSheet';
import { Button } from '@/shared/ui/Button';
import { Card, Divider, FloatingCard } from '@/shared/ui/Card';
import { HeaderIconButton } from '@/shared/ui/HeaderBar';
import { EllipsisIcon, PackageIcon, StickyNoteIcon, UserCheckIcon } from '@/shared/ui/icons';
import { KeyValueRow } from '@/shared/ui/KeyValueRow';
import { ModuleHeader } from '@/shared/ui/ModuleHeader';
import { ModuleScreen } from '@/shared/ui/ModuleScreen';
import { NoteField } from '@/shared/ui/NoteField';
import { onBlue, useHeaderColors } from '@/shared/ui/ScreenShell';
import { SectionTitle } from '@/shared/ui/SectionTitle';
import { ListSkeleton } from '@/shared/ui/Skeleton';
import { ErrorState } from '@/shared/ui/StateViews';
import { Text } from '@/shared/ui/Text';
import { toast } from '@/shared/ui/Toast';
import { usePullRefresh } from '@/shared/hooks/usePullRefresh';

import { parcelsApi } from '../api/parcel.api';
import { daysLeftLower } from '../components/ParcelDeadlineTag';
import { ParcelTimeline } from '../components/ParcelTimeline';
import { PhotoStrip } from '../components/PhotoStrip';
import { useParcel } from '../hooks/useParcel';
import { ParcelStatus, type ParcelDto } from '../types';
import { isOpenParcel, MAX_PARCEL_FILES, parcelDeadline, senderTitle } from '../utils/parcel';

type MoreAction = { label: string; destructive?: boolean; onPress: () => void };

/**
 * Chi tiết bưu phẩm (6e), laid out like a văn thư document: status pills, the sender and the received time on
 * the header, the pickup deadline (or hand-over / cancel date) floating over it, then the receiver, the
 * parcel's details, photos and history. Reception actions follow the state matrix (CLAUDE.md §2.3).
 */
export function ParcelDetailScreen() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  // `onBehalf=1`: opened from a "Nhận thay" row of Bưu phẩm của tôi (the detail itself carries no delegation).
  const { id, onBehalf } = useLocalSearchParams<{ id: string; onBehalf?: string }>();
  const parcel = useParcel(id);
  const pull = usePullRefresh(() => parcel.refetch());
  const me = useParcelMe();
  const { has } = useCapabilities();
  const reception = has('parcel.reception');
  const [noteOpen, setNoteOpen] = useState(false);
  const [cancelNote, setCancelNote] = useState('');
  const p = parcel.data;

  const refresh = () => void queryClient.invalidateQueries({ queryKey: qk.parcels.root });
  const onError = (e: unknown) => toast.error(errorMessage(e, t));

  const remind = useMutation({ mutationFn: () => parcelsApi.remind(id), onSuccess: () => toast.success(t('parcels.reminded')), onError });
  const remove = useMutation({
    mutationFn: () => parcelsApi.remove(id),
    onSuccess: () => {
      toast.success(t('parcels.deleted'));
      refresh();
      goBack('/parcels');
    },
    onError,
  });
  const saveCancelNote = useMutation({
    mutationFn: () => {
      const current = parcel.data!;
      return parcelsApi.update(id, {
        trackingNumber: current.trackingNumber,
        senderFullName: current.senderFullName,
        receiverId: current.receiverId,
        departmentId: current.departmentId,
        attachmentFiles: [],
        attachmentIds: current.attachments.map((a) => a.id),
        cancellationNote: cancelNote.trim(),
      });
    },
    onSuccess: () => {
      toast.success(t('parcels.cancelNoteSaved'));
      setNoteOpen(false);
      refresh();
    },
    onError,
  });

  const header = (content?: ReactNode, right?: ReactNode, bottom = 18) => (
    <ModuleHeader
      testID="parcel-header"
      icon={PackageIcon}
      title={t('parcels.detailTitle')}
      subtitle={p ? t('parcels.detailSubtitle', { code: p.transactionCode, tracking: p.trackingNumber }) : undefined}
      subtitleMono
      right={right}
      bottom={bottom}
    >
      {content}
    </ModuleHeader>
  );

  if (!p) {
    return (
      <ModuleScreen header={header(undefined, undefined, 24)}>
        {parcel.isError ? <ErrorState error={parcel.error} onRetry={() => void parcel.refetch()} /> : <ListSkeleton count={3} />}
      </ModuleScreen>
    );
  }

  const open = isOpenParcel(p.status);
  const deadline = parcelDeadline(p);
  const isMine = sameId(p.receiverId, me.data?.id);

  const confirmDelete = () =>
    Alert.alert(t('parcels.delete'), t('parcels.deleteConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('parcels.delete'), style: 'destructive', onPress: () => remove.mutate() },
    ]);

  // Reception actions per the state matrix (CLAUDE.md §2.3); the rest goes to the "…" menu.
  const actions: ReactNode[] = [];
  const more: MoreAction[] = [];
  if (reception) {
    if (p.status === ParcelStatus.Waiting) {
      actions.push(<Button key="edit" testID="parcel-edit" className="flex-1" variant="ghost" label={t('parcels.edit')} onPress={() => router.push({ pathname: '/parcels/reception/new', params: { id: p.id } })} />);
      more.push({ label: t('parcels.delete'), destructive: true, onPress: confirmDelete });
    }
    if (p.status === ParcelStatus.Due || p.status === ParcelStatus.Overdue) {
      actions.push(<Button key="remind" testID="parcel-remind" className="flex-1" variant="ghost" label={t('parcels.remind')} loading={remind.isPending} onPress={() => remind.mutate()} />);
    }
    if (open) {
      actions.push(
        <Button key="handover" testID="parcel-handover" className="flex-[1.4]" icon={UserCheckIcon} label={t('parcels.handover')} onPress={() => router.push({ pathname: '/parcels/reception/handover', params: { ids: p.id } })} />,
      );
    }
    if (p.status === ParcelStatus.Cancelled && !p.cancellationReason) {
      actions.push(<Button key="note" className="flex-1" variant="ghost" label={t('parcels.addCancelNote')} onPress={() => setNoteOpen(true)} />);
    }
  }

  const moreButton = more.length ? (
    <HeaderIconButton
      testID="parcel-more"
      icon={EllipsisIcon}
      label={t('common.more')}
      onPress={() =>
        Alert.alert(p.transactionCode, undefined, [
          ...more.map((m) => ({ text: m.label, style: m.destructive ? ('destructive' as const) : ('default' as const), onPress: m.onPress })),
          { text: t('common.cancel'), style: 'cancel' as const },
        ])
      }
    />
  ) : undefined;

  return (
    <ModuleScreen
      header={header(<DetailHero parcel={p} onBehalf={onBehalf === '1' && !isMine} />, moreButton)}
      floating={<DateCard parcel={p} />}
      floatingScrolls
      footer={actions.length ? actions : undefined}
      refreshControl={<RefreshControl refreshing={pull.refreshing} onRefresh={() => void pull.onRefresh()} />}
    >
      {p.status === ParcelStatus.Overdue && deadline ? <Banner tone="danger">{t('parcels.overdueNote', { date: formatKey(deadline.cancelKey) })}</Banner> : null}
      {p.status === ParcelStatus.Cancelled ? <Banner tone="off">{t('parcels.cancelledNote')}</Banner> : null}

      <ReceiverCard parcel={p} isMine={isMine} />

      <Card className="pt-1" testID="parcel-info">
        <View className="px-3.5 pb-0.5 pt-2.5">
          <SectionTitle>{t('parcels.infoTitle')}</SectionTitle>
        </View>
        <KeyValueRow label={t('parcels.sender')} value={p.senderFullName} />
        {p.senderCompanyName && p.senderCompanyName !== p.senderFullName ? <KeyValueRow divider label={t('parcels.senderCompany')} value={p.senderCompanyName} /> : null}
        {p.senderPhoneNumber ? <KeyValueRow divider label={t('parcels.senderPhone')} value={p.senderPhoneNumber} mono /> : null}
        {p.senderAddress ? <KeyValueRow divider label={t('parcels.senderAddress')} value={p.senderAddress} /> : null}
        <KeyValueRow divider label={t('parcels.tracking')} value={p.trackingNumber} mono />
        <KeyValueRow divider label={t('parcels.code')} value={p.transactionCode} mono />
        <KeyValueRow divider label={t('parcels.department')} value={p.departmentName ?? '—'} />
        {p.description ? <KeyValueRow divider label={t('parcels.description')} value={p.description} /> : null}
        {p.cancellationReason ? <KeyValueRow divider label={t('parcels.cancellationReason')} value={p.cancellationReason} /> : null}
      </Card>

      {p.attachments.length ? (
        <Card className="gap-2.5 p-3.5">
          <SectionTitle right={`${p.attachments.length}/${MAX_PARCEL_FILES}`}>{t('parcels.photosTitle')}</SectionTitle>
          <PhotoStrip attachments={p.attachments} />
        </Card>
      ) : null}

      {p.logs.length ? (
        <Card className="gap-3 p-3.5">
          <SectionTitle>{t('parcels.history')}</SectionTitle>
          <ParcelTimeline logs={p.logs} status={p.status} />
        </Card>
      ) : null}

      <BottomSheet
        visible={noteOpen}
        onClose={() => setNoteOpen(false)}
        icon={StickyNoteIcon}
        iconTone="off"
        title={t('reception.cancelNote')}
        caption={p.transactionCode}
        footer={<Button label={t('common.save')} loading={saveCancelNote.isPending} disabled={!cancelNote.trim()} onPress={() => saveCancelNote.mutate()} />}
      >
        <Text className="text-sub text-muted">{t('reception.cancelNoteHint')}</Text>
        <NoteField value={cancelNote} onChangeText={setCancelNote} />
      </BottomSheet>
    </ModuleScreen>
  );
}

/**
 * On the header (văn thư DetailHero): the status pill (white while it waits to be collected, red once
 * overdue), "Nhận thay" when I collect it for someone, the sender, then when reception took it in.
 */
function DetailHero({ parcel: p, onBehalf }: { parcel: ParcelDto; onBehalf: boolean }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { fg, text2 } = useHeaderColors();
  const received = parseServerDate(p.receivedAt ?? p.createdAt);
  const pill =
    p.status === ParcelStatus.Overdue
      ? { bg: colors.danger, fg: '#FFFFFF' }
      : isOpenParcel(p.status)
        ? { bg: fg, fg: colors.primary }
        : { bg: onBlue(0.14), fg };

  return (
    <View className="gap-2 pb-2">
      <View className="flex-row flex-wrap gap-2">
        <View testID="parcel-status" className="h-[26px] justify-center rounded-full px-2.5" style={{ backgroundColor: pill.bg }}>
          <Text weight="bold" numberOfLines={1} maxFontSizeMultiplier={1.2} style={{ fontSize: 12, lineHeight: 16, color: pill.fg }}>
            {t(`status.parcel.${String(p.status) as '1'}`)}
          </Text>
        </View>
        {onBehalf ? (
          <View className="h-[26px] justify-center rounded-full px-2.5" style={{ backgroundColor: onBlue(0.14) }}>
            <Text weight="semibold" numberOfLines={1} maxFontSizeMultiplier={1.2} style={{ fontSize: 12, lineHeight: 16, color: fg }}>
              {t('parcels.collectFor', { name: p.receiverFullName })}
            </Text>
          </View>
        ) : null}
      </View>
      <Text weight="bold" accessibilityRole="header" numberOfLines={3} style={{ fontSize: 19, lineHeight: 25, letterSpacing: -0.2, color: fg }}>
        {senderTitle(p)}
      </Text>
      {received ? (
        <Text numberOfLines={1} style={{ fontSize: 12.5, lineHeight: 17, color: text2 }}>
          {t('parcels.receivedAt', { time: formatTime(received), date: formatDate(received) })}
        </Text>
      ) : null}
    </View>
  );
}

/** Floating card (văn thư DeadlineCard): "Hạn nhận 21/10/2026 · còn 2 ngày", or when it was handed over / cancelled. */
function DateCard({ parcel: p }: { parcel: ParcelDto }) {
  const { t } = useTranslation();
  const deadline = parcelDeadline(p);
  const handOverAt = parseServerDate(p.handOverAt);
  const cancelledAt = parseServerDate(p.cancelledAt);

  let row: { label: string; value: string; rest?: string; tone?: 'danger' | 'warning' } | null = null;
  if (p.status === ParcelStatus.HandedOver && handOverAt) {
    row = { label: t('parcels.handedLabel'), value: `${formatTime(handOverAt)} ${formatDate(handOverAt)}` };
  } else if (p.status === ParcelStatus.Cancelled) {
    const date = cancelledAt ? formatDate(cancelledAt) : deadline ? formatKey(deadline.cancelKey) : null;
    if (date) row = { label: t('parcels.cancelledLabel'), value: date };
  } else if (deadline) {
    row = {
      label: t('parcels.deadlineLabel'),
      value: formatKey(deadline.dueKey),
      rest: daysLeftLower(t, deadline),
      tone: p.status === ParcelStatus.Overdue || deadline.daysLeft < 0 ? 'danger' : p.status === ParcelStatus.Due || deadline.daysLeft <= 1 ? 'warning' : undefined,
    };
  }
  if (!row) return null;

  const accent = row.tone === 'danger' ? 'text-danger' : row.tone === 'warning' ? 'text-warning-text' : undefined;
  return (
    <FloatingCard testID="parcel-date" className="mx-4 flex-row items-center justify-between gap-3 px-4 py-3.5" radius={20}>
      <Text weight="semibold" className="text-muted" style={{ fontSize: 13, lineHeight: 17 }}>
        {row.label}
      </Text>
      <View className="flex-row items-baseline gap-2">
        <Text mono weight="bold" className={row.tone === 'danger' ? 'text-danger' : undefined} style={{ fontSize: 16, lineHeight: 21 }}>
          {row.value}
        </Text>
        {row.rest ? (
          <Text weight="semibold" className={accent ?? 'text-muted'} style={{ fontSize: 12.5, lineHeight: 16 }}>
            {`· ${row.rest}`}
          </Text>
        ) : null}
      </View>
    </FloatingCard>
  );
}

/** "Người nhận": avatar, name ("Bạn · …" when it is me), MSNV · unit; once handed over, who collected it and the hand-over note. */
function ReceiverCard({ parcel: p, isMine }: { parcel: ParcelDto; isMine: boolean }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const collectedByOther = p.status === ParcelStatus.HandedOver && p.actualReceiverCode && !sameId(p.actualReceiverCode, p.receiverCode);
  return (
    <Card className="gap-3 p-3.5" testID="parcel-receiver">
      <SectionTitle>{t('parcels.receiverTitle')}</SectionTitle>
      <View className="min-h-[48px] flex-row items-center gap-3">
        <Avatar name={p.receiverFullName} uri={p.receiverAvatarUrl} size={36} />
        <View className="min-w-0 flex-1 gap-0.5">
          <Text weight="semibold" numberOfLines={1} style={{ fontSize: 14, lineHeight: 19 }}>
            {isMine ? t('parcels.youName', { name: p.receiverFullName }) : p.receiverFullName}
          </Text>
          <Text numberOfLines={1} className="text-muted" style={{ fontSize: 12, lineHeight: 16 }}>
            <Text mono className="text-muted" style={{ fontSize: 12, lineHeight: 16 }}>
              {p.receiverCode}
            </Text>
            {p.departmentName ? ` · ${p.departmentName}` : ''}
          </Text>
        </View>
      </View>
      {collectedByOther ? (
        <>
          <Divider />
          <KeyValueRow compact label={t('parcels.actualReceiver')} value={p.actualReceiverCode ?? ''} mono />
        </>
      ) : null}
      {p.note ? (
        <View className="rounded-[12px] bg-panel px-3 py-2.5" style={{ borderLeftWidth: 3, borderLeftColor: colors.primary }}>
          <Text style={{ fontSize: 13.5, lineHeight: 19 }}>{p.note}</Text>
        </View>
      ) : null}
    </Card>
  );
}
