import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { sameId } from '@/core/session/userTypes';
import { formatDayMonth, parseServerDate } from '@/core/time/vn';
import { cn } from '@/shared/lib/cn';
import { Avatar } from '@/shared/ui/Avatar';
import { useCardStyle } from '@/shared/ui/Card';
import { Icon } from '@/shared/ui/Icon';
import { CheckIcon } from '@/shared/ui/icons';
import { ParcelBadge } from '@/shared/ui/StatusBadge';
import { Text } from '@/shared/ui/Text';

import { ParcelStatus, type ParcelDto } from '../types';
import { isOpenParcel, senderTitle, splitTracking } from '../utils/parcel';
import { parcelSubline } from './ParcelCard';
import { ParcelDeadlineTag } from './ParcelDeadlineTag';

type Props = {
  parcel: ParcelDto;
  selected: boolean;
  onToggle: () => void;
  onPress: () => void;
};

/**
 * Reception row, the "Bưu phẩm của tôi" row plus who it is for: a checkbox for open parcels (bulk
 * handover), carrier code · parcel code · received date, the sender, the receiver with MSNV and unit,
 * then status and deadline.
 */
export function ReceptionParcelCard({ parcel: p, selected, onToggle, onPress }: Props) {
  const { t } = useTranslation();
  const cardStyle = useCardStyle(false, selected);
  const open = isOpenParcel(p.status);
  const cancelled = p.status === ParcelStatus.Cancelled;
  const received = parseServerDate(p.receivedAt ?? p.createdAt);
  const subline = parcelSubline(p);

  return (
    <Pressable
      testID={`reception-parcel-${p.trackingNumber}`}
      accessibilityRole="button"
      accessibilityLabel={`${p.trackingNumber}, ${senderTitle(p)}, ${p.receiverFullName}`}
      onPress={onPress}
      className="flex-row gap-3 rounded-card p-3.5 active:opacity-90"
      style={[cardStyle, { flexShrink: 0 }]}
    >
      {open ? (
        <Pressable
          testID={`reception-check-${p.trackingNumber}`}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: selected }}
          accessibilityLabel={t('reception.select', { code: p.trackingNumber })}
          onPress={onToggle}
          hitSlop={12}
          className={cn('h-[22px] w-[22px] items-center justify-center rounded-[7px]', selected ? 'bg-primary' : 'border-2 border-line-strong')}
        >
          {selected ? <Icon icon={CheckIcon} size={12} weight="bold" color="on-primary" /> : null}
        </Pressable>
      ) : null}

      <View className="min-w-0 flex-1 gap-2">
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

        <View className="gap-0.5">
          <Text weight={open ? 'bold' : 'semibold'} numberOfLines={2} className={cancelled ? 'text-muted' : undefined} style={{ fontSize: 14, lineHeight: 20 }}>
            {senderTitle(p)}
          </Text>
          {subline ? (
            <Text numberOfLines={1} className="text-muted" style={{ fontSize: 12, lineHeight: 16 }}>
              {subline}
            </Text>
          ) : null}
        </View>

        <View className="flex-row items-center gap-2">
          <Avatar name={p.receiverFullName} uri={p.receiverAvatarUrl} size={22} />
          <Text numberOfLines={1} className="min-w-0 flex-1 text-muted" style={{ fontSize: 12.5, lineHeight: 17 }}>
            <Text weight="semibold" className="text-ink" style={{ fontSize: 12.5, lineHeight: 17 }}>
              {p.receiverFullName}
            </Text>
            {` · ${[p.receiverCode, p.departmentName].filter(Boolean).join(' · ')}`}
          </Text>
        </View>

        <View className="flex-row flex-wrap items-center gap-x-2 gap-y-1.5">
          <ParcelBadge status={p.status} short />
          <ParcelDeadlineTag parcel={p} collector={p.actualReceiverCode && !sameId(p.actualReceiverCode, p.receiverCode) ? t('parcels.collectedBy', { code: p.actualReceiverCode }) : undefined} />
        </View>
      </View>
    </Pressable>
  );
}
