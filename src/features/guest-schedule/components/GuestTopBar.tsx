import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { goBack } from '@/shared/lib/navigation';
import { Icon } from '@/shared/ui/Icon';
import { ChevronLeftIcon, ShieldCheckIcon } from '@/shared/ui/icons';
import { shadows } from '@/shared/ui/shadows';
import { Text } from '@/shared/ui/Text';

type Props = {
  title: string;
  subtitle?: string;
  /** The module's shield logo before the title (the dashboard). */
  logo?: boolean;
  /** Where Back goes when there is no screen to return to. */
  fallback?: Parameters<typeof goBack>[0];
  testID?: string;
};

/** Toolbar of the guest screens on their own background: a white round Back, the logo, the title over its subtitle. */
export function GuestTopBar({ title, subtitle, logo, fallback, testID }: Props) {
  const { t } = useTranslation();
  return (
    <View testID={testID} className="flex-row items-center gap-3">
      <Pressable
        testID={testID ? `${testID}-back` : undefined}
        accessibilityRole="button"
        accessibilityLabel={t('common.back')}
        onPress={() => goBack(fallback)}
        className="h-10 w-10 items-center justify-center rounded-full bg-elevated active:opacity-70"
        style={shadows.card}
      >
        <Icon icon={ChevronLeftIcon} size={20} color="ink" weight="bold" />
      </Pressable>
      {logo ? (
        <View className="h-10 w-10 items-center justify-center rounded-[12px] bg-primary">
          <Icon icon={ShieldCheckIcon} size={21} color="on-primary" weight="bold" />
        </View>
      ) : null}
      <View className="min-w-0 flex-1">
        <Text weight="bold" accessibilityRole="header" numberOfLines={1} className="text-ink" style={{ fontSize: 19, lineHeight: 24, letterSpacing: -0.2 }}>
          {title}
        </Text>
        {subtitle ? (
          <Text weight="medium" numberOfLines={1} className="text-muted" style={{ fontSize: 12.5, lineHeight: 16 }}>
            {subtitle}
          </Text>
        ) : null}
      </View>
    </View>
  );
}
