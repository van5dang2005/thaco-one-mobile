import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { PressableCard } from '@/shared/ui/Card';
import { Icon } from '@/shared/ui/Icon';
import { Text } from '@/shared/ui/Text';
import { useToneColors } from '@/shared/ui/tones';

import type { NotificationSource } from '../types';
import type { FeedItem } from '../utils/feed';

type Props = {
  item: FeedItem;
  source: NotificationSource;
  /** Clock time today and yesterday, date and time before (the day group says which day). */
  time: string;
  onPress: () => void;
  onLongPress?: () => void;
};

/**
 * Notification row, text-first like the Văn thư lists: a small round glyph in the notification's tone, the module
 * and time on the first line (unread = primary dot), the title (bold while unread) and two lines of content.
 */
export function NotificationRow({ item, source, time, onPress, onLongPress }: Props) {
  const { t } = useTranslation();
  const { icon, tone } = source.appearance(item);
  const colors = useToneColors(tone);
  const unread = !item.isRead;
  const module = source.label(t);

  return (
    <PressableCard
      testID={`notification-${item.id}`}
      accessibilityLabel={[unread ? t('notifications.unread') : null, module, item.title, item.body, time].filter(Boolean).join(', ')}
      onPress={onPress}
      onLongPress={onLongPress}
      className="flex-row gap-3 p-3.5"
    >
      <View className="h-9 w-9 items-center justify-center rounded-full" style={{ backgroundColor: colors.tint }}>
        <Icon icon={icon} size={17} rawColor={colors.solid} />
      </View>
      <View className="min-w-0 flex-1 gap-1">
        <View className="flex-row items-center gap-2">
          <Text weight="semibold" numberOfLines={1} className="flex-1 text-muted" style={{ fontSize: 12, lineHeight: 16 }}>
            {module}
          </Text>
          <Text mono className="text-muted" style={{ fontSize: 12, lineHeight: 16 }}>
            {time}
          </Text>
          {unread ? <View className="h-2 w-2 rounded-full bg-primary" /> : null}
        </View>
        <Text weight={unread ? 'bold' : 'medium'} numberOfLines={2} style={{ fontSize: 14, lineHeight: 20 }}>
          {item.title || t('notifications.title')}
        </Text>
        {item.body ? (
          <Text numberOfLines={2} className="text-muted" style={{ fontSize: 13, lineHeight: 18 }}>
            {item.body}
          </Text>
        ) : null}
        {item.href ? null : (
          <Text className="text-subtle" style={{ fontSize: 12, lineHeight: 16 }}>
            {t('notifications.cannotOpen')}
          </Text>
        )}
      </View>
    </PressableCard>
  );
}
