import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { sameId } from '@/core/session/userTypes';
import { formatDayMonth, parseServerDate } from '@/core/time/vn';
import { cn } from '@/shared/lib/cn';
import { PressableCard } from '@/shared/ui/Card';
import { UserCheckIcon } from '@/shared/ui/icons';
import type { RoundIconTone } from '@/shared/ui/RoundIcon';
import { parcelBadgeKind } from '@/shared/ui/status';
import { ParcelBadge, Tag } from '@/shared/ui/StatusBadge';
import { Text } from '@/shared/ui/Text';

import { LookupMatchReason, ParcelStatus, type ParcelLookupDto } from '../types';
import { isOpenParcel, senderTitle, splitTracking } from '../utils/parcel';
import { ParcelDeadlineTag } from './ParcelDeadlineTag';

/** Package icon tone follows the status badge (wait / warn / danger / ok / off). */
export const parcelIconTone = (status: ParcelStatus): RoundIconTone => parcelBadgeKind(status) as RoundIconTone;

type Props = { parcel: ParcelLookupDto; myCode?: string | null; onPress: () => void };

/** Second line of a row: the description, else the sender's name when the title shows the company. */
export function parcelSubline(p: Pick<ParcelLookupDto, 'description' | 'senderCompanyName' | 'senderFullName'>) {
  if (p.description) return p.description;
  return p.senderCompanyName && p.senderCompanyName !== p.senderFullName ? p.senderFullName : null;
}

/** I collect this parcel for its receiver (a detailed or default delegation matched it). */
export const isOnBehalf = (p: Pick<ParcelLookupDto, 'matchReason'>) =>
  p.matchReason === LookupMatchReason.DetailedDelegation || p.matchReason === LookupMatchReason.DefaultDelegation;

/**
 * Row of "Bưu phẩm của tôi" (6d), laid out like a văn thư row: the carrier code (mono, bold) with the
 * parcel code and the received date, the sender on up to two lines, the description, then the status,
 * "Nhận thay …" when I collect it for someone, and the deadline or hand-over time.
 */
export function ParcelCard({ parcel: p, myCode, onPress }: Props) {
  const { t } = useTranslation();
  const open = isOpenParcel(p.status);
  const cancelled = p.status === ParcelStatus.Cancelled;
  const received = parseServerDate(p.receivedAt ?? p.createdAt);
  const subline = parcelSubline(p);
  // Who collected it, only when that was not the receiver: me (collecting on their behalf) or someone else.
  const collector =
    !p.actualReceiverCode || sameId(p.actualReceiverCode, p.receiverCode)
      ? undefined
      : sameId(p.actualReceiverCode, myCode)
        ? t('parcels.collectedByYou')
        : t('parcels.collectedBy', { code: p.actualReceiverCode });

  return (
    <PressableCard
      testID={`parcel-${p.trackingNumber}`}
      accessibilityLabel={`${p.trackingNumber}, ${senderTitle(p)}`}
      onPress={onPress}
      className="gap-2 p-3.5"
      style={{ flexShrink: 0 }}
    >
      <View className="flex-row items-center gap-2">
        <Text mono weight="bold" numberOfLines={1} className={cn('flex-shrink', cancelled && 'text-muted')} style={{ fontSize: 14, lineHeight: 18 }}>
          {splitTracking(p.trackingNumber).code}
        </Text>
        <Text mono numberOfLines={1} className="flex-1 text-muted" style={{ fontSize: 12, lineHeight: 16 }}>
          {p.transactionCode}
        </Text>
        {received ? (
          <Text mono className="text-muted" style={{ fontSize: 12, lineHeight: 16 }}>
            {formatDayMonth(received)}
          </Text>
        ) : null}
      </View>

      <Text weight={open ? 'bold' : 'semibold'} numberOfLines={2} className={cancelled ? 'text-muted' : undefined} style={{ fontSize: 14, lineHeight: 20 }}>
        {senderTitle(p)}
      </Text>
      {subline ? (
        <Text numberOfLines={1} className="text-muted" style={{ fontSize: 12, lineHeight: 16 }}>
          {subline}
        </Text>
      ) : null}

      <View className="flex-row flex-wrap items-center gap-x-2 gap-y-1.5">
        <ParcelBadge status={p.status} short />
        {isOnBehalf(p) ? <Tag icon={UserCheckIcon} label={t('parcels.collectFor', { name: p.receiverFullName })} /> : null}
        <ParcelDeadlineTag parcel={p} collector={collector} />
      </View>
    </PressableCard>
  );
}
