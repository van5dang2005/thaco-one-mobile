import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import type { ColorToken } from '@/core/theme/palette';
import { formatDayMonth, formatKey, formatTime, parseServerDate } from '@/core/time/vn';
import { Icon } from '@/shared/ui/Icon';
import { type AppIcon, CalendarOffIcon, CircleCheckIcon, ClockAlertIcon, ClockIcon } from '@/shared/ui/icons';
import { Text } from '@/shared/ui/Text';

import { ParcelStatus, type ParcelDto } from '../types';
import { parcelDeadline, type Deadline } from '../utils/parcel';

/** "còn N ngày" / "hôm nay" / "quá hạn N ngày": the rest of the "Hạn nhận" line, lower case. */
export function daysLeftLower(t: TFunction, deadline: Deadline) {
  return deadline.daysLeft > 0
    ? t('parcels.daysLeftLower', { count: deadline.daysLeft })
    : deadline.daysLeft === 0
      ? t('parcels.dueTodayLower')
      : t('parcels.overdueDaysLower', { count: -deadline.daysLeft });
}

type Props = {
  parcel: Pick<ParcelDto, 'status' | 'createdAt' | 'receivedAt' | 'handOverAt'>;
  /** Shown after the hand-over time: "bạn nhận" / "0123456 nhận". */
  collector?: string;
  testID?: string;
};

/**
 * The time line of a parcel row, after its status badge (the văn thư DeadlineTag): "Hạn 21/10 · còn 2 ngày"
 * (muted), "Hạn 21/10 · hôm nay" (amber, also while Đến hạn), "Quá hạn 2 ngày · tự hủy ~24/10" (red),
 * "Giao 14:20 · 14/10" once handed over, "Tự hủy 24/10" once cancelled.
 */
export function ParcelDeadlineTag({ parcel, collector, testID }: Props) {
  const { t } = useTranslation();
  const deadline = parcelDeadline(parcel);
  const handOverAt = parseServerDate(parcel.handOverAt);

  let tag: { label: string; color: ColorToken; icon: AppIcon } | null = null;
  if (parcel.status === ParcelStatus.HandedOver) {
    if (handOverAt) {
      const at = t('parcels.handedTag', { time: formatTime(handOverAt), date: formatDayMonth(handOverAt) });
      tag = { label: collector ? `${at} · ${collector}` : at, color: 'muted', icon: CircleCheckIcon };
    }
  } else if (deadline && parcel.status === ParcelStatus.Cancelled) {
    tag = { label: t('parcels.cancelledTag', { date: formatKey(deadline.cancelKey, false) }), color: 'muted', icon: CalendarOffIcon };
  } else if (deadline) {
    const due = formatKey(deadline.dueKey, false);
    tag =
      parcel.status === ParcelStatus.Overdue || deadline.daysLeft < 0
        ? { label: t('parcels.overdueTag', { count: Math.max(1, -deadline.daysLeft), date: formatKey(deadline.cancelKey, false) }), color: 'danger', icon: ClockAlertIcon }
        : {
            label: t('parcels.dueTag', { date: due, rest: daysLeftLower(t, deadline) }),
            color: parcel.status === ParcelStatus.Due || deadline.daysLeft <= 1 ? 'warning-text' : 'muted',
            icon: parcel.status === ParcelStatus.Due ? ClockAlertIcon : ClockIcon,
          };
  }
  if (!tag) return null;

  const quiet = tag.color === 'muted';
  return (
    <View testID={testID} className="min-w-0 flex-shrink flex-row items-center gap-1">
      <Icon icon={tag.icon} size={13} color={tag.color} weight={quiet ? 'regular' : 'bold'} />
      <Text
        weight={quiet ? 'medium' : 'semibold'}
        numberOfLines={1}
        className={tag.color === 'danger' ? 'flex-shrink text-danger' : tag.color === 'warning-text' ? 'flex-shrink text-warning-text' : 'flex-shrink text-muted'}
        style={{ fontSize: 12, lineHeight: 16 }}
      >
        {tag.label}
      </Text>
    </View>
  );
}
