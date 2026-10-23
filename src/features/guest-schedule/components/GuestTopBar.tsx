import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { goBack } from '@/shared/lib/navigation';
import { HeaderIconButton } from '@/shared/ui/HeaderBar';
import { Icon } from '@/shared/ui/Icon';
import { ChevronLeftIcon, ShieldCheckIcon } from '@/shared/ui/icons';
import { onBlue, useHeaderColors } from '@/shared/ui/ScreenShell';
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

/** Toolbar of the guest screens on the blue of their picture, as on the blue headers: Back, the logo, the title over its subtitle. */
export function GuestTopBar({ title, subtitle, logo, fallback, testID }: Props) {
  const { t } = useTranslation();
  const { fg, text2 } = useHeaderColors();
  return (
    <View testID={testID} className="flex-row items-center gap-3">
      <HeaderIconButton testID={testID ? `${testID}-back` : undefined} icon={ChevronLeftIcon} label={t('common.back')} onPress={() => goBack(fallback)} />
      {logo ? (
        <View className="h-10 w-10 items-center justify-center rounded-[12px]" style={{ backgroundColor: onBlue(0.16), borderWidth: 1, borderColor: onBlue(0.22) }}>
          <Icon icon={ShieldCheckIcon} size={20} rawColor={fg} weight="bold" />
        </View>
      ) : null}
      <View className="min-w-0 flex-1">
        <Text weight="bold" accessibilityRole="header" numberOfLines={1} style={{ fontSize: 19, lineHeight: 24, letterSpacing: -0.2, color: fg }}>
          {title}
        </Text>
        {subtitle ? (
          <Text weight="medium" numberOfLines={1} style={{ fontSize: 12.5, lineHeight: 16, color: text2 }}>
            {subtitle}
          </Text>
        ) : null}
      </View>
    </View>
  );
}
