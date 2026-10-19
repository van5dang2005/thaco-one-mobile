import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import type { ColorToken } from '@/core/theme/palette';
import { useTheme } from '@/core/theme/ThemeProvider';
import { formatTime } from '@/core/time/vn';
import { Card } from '@/shared/ui/Card';
import { Icon } from '@/shared/ui/Icon';
import { BuildingIcon, UsersIcon } from '@/shared/ui/icons';
import type { BadgeKind } from '@/shared/ui/status';
import { StatusBadge } from '@/shared/ui/StatusBadge';
import { Text } from '@/shared/ui/Text';

import type { GuestScheduleItem, GuestVisitStatus } from '../types';
import { visitEnd, visitStart } from '../utils/dashboard';

export const visitStatusKinds: Record<GuestVisitStatus, BadgeKind> = { pending: 'warn', confirmed: 'ok', checkedIn: 'live', checkedOut: 'off' };
/** Colour of the card's left edge per status. */
const edgeColors: Record<GuestVisitStatus, ColorToken> = { pending: 'warning', confirmed: 'success', checkedIn: 'success', checkedOut: 'subtle' };

/** One visit: the status edge, start over end time, a hairline, then the group, the company, the head count and the status. */
export function VisitCard({ visit }: { visit: GuestScheduleItem }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  return (
    <Card testID={`guests-visit-${visit.id}`} className="flex-row">
      <View className="w-[3px]" style={{ backgroundColor: colors[edgeColors[visit.status]] }} />
      <View className="w-[67px] items-center justify-center border-r border-line-2 py-3.5">
        <Text weight="bold" numeric className="text-ink" style={{ fontSize: 15, lineHeight: 20 }}>
          {formatTime(visitStart(visit))}
        </Text>
        <Text numeric className="text-subtle" style={{ fontSize: 12.5, lineHeight: 17 }}>
          {formatTime(visitEnd(visit))}
        </Text>
      </View>
      <View className="min-w-0 flex-1 gap-1 px-3.5 py-3">
        <Text weight="semibold" numberOfLines={2} className="text-ink" style={{ fontSize: 15.5, lineHeight: 21 }}>
          {visit.groupName}
        </Text>
        {visit.company ? (
          <View className="flex-row items-center gap-1.5">
            <Icon icon={BuildingIcon} size={13} color="subtle" />
            <Text numberOfLines={1} className="min-w-0 flex-1 text-muted" style={{ fontSize: 13, lineHeight: 18 }}>
              {visit.company}
            </Text>
          </View>
        ) : null}
        <View className="mt-1 flex-row items-center gap-2">
          <Icon icon={UsersIcon} size={13} color="subtle" />
          <Text className="flex-1 text-muted" style={{ fontSize: 13, lineHeight: 18 }}>
            {t('guestSchedule.dashboard.guests', { count: visit.guestCount })}
          </Text>
          <StatusBadge kind={visitStatusKinds[visit.status]} label={t(`guestSchedule.dashboard.status.${visit.status}`)} />
        </View>
      </View>
    </Card>
  );
}
