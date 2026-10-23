import { useTranslation } from 'react-i18next';
import { Alert, Linking, Modal, Platform, View } from 'react-native';

import { env } from '@/core/config/env';
import { withAlpha } from '@/core/theme/palette';
import { useTheme } from '@/core/theme/ThemeProvider';
import { Button } from '@/shared/ui/Button';
import { Icon } from '@/shared/ui/Icon';
import { ArrowRightIcon, ShieldCheckIcon } from '@/shared/ui/icons';
import { shadows } from '@/shared/ui/shadows';
import { Text } from '@/shared/ui/Text';

import type { StoreRelease } from '../utils/storeVersion';
import { StoreUpdateArt } from './StoreUpdateArt';

const storeName = Platform.OS === 'ios' ? 'App Store' : 'Google Play';
/** The bottom sheets' dimmed backdrop, rgba(11, 20, 32, .55). */
const BACKDROP = withAlpha('#0B1420', 0.55);

/**
 * Popup over the dimmed app while the store has a newer version than this build: no close button, a tap on the
 * backdrop does nothing and neither does Android's back button. The only way on is the store page; the new binary
 * restarts the app without it.
 */
export function StoreUpdateDialog({ release }: { release: StoreRelease }) {
  const { t } = useTranslation();
  const { colors } = useTheme();

  const openStore = () => {
    Linking.openURL(release.storeUrl).catch(() => Alert.alert(t('appUpdate.store.title'), t('appUpdate.store.openFailed', { store: storeName }), [{ text: t('common.ok') }]));
  };

  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent navigationBarTranslucent onRequestClose={() => undefined}>
      <View className="flex-1 items-center justify-center px-5" style={{ backgroundColor: BACKDROP }}>
        {/* The shadow on an outer box: the inner one clips the picture to the rounded corners. */}
        <View testID="store-update-dialog" className="w-full rounded-sheet" style={[{ maxWidth: 380 }, shadows.card]}>
          <View className="overflow-hidden rounded-sheet" style={{ backgroundColor: colors.surface }}>
            <View style={{ height: 196 }}>
              <StoreUpdateArt />
            </View>

            <View className="items-center gap-2 px-5 pb-5">
              <Text weight="bold" className="text-center text-sheet">
                {t('appUpdate.store.title')}
              </Text>
              <Text className="text-center text-body text-muted">{t('appUpdate.store.body', { store: storeName })}</Text>

              <View className="mt-2 w-full flex-row items-center rounded-tile bg-field px-4 py-3">
                <View className="flex-1 items-center gap-1">
                  <Text className="text-meta text-muted">{t('appUpdate.store.current')}</Text>
                  <Text testID="store-update-current" mono weight="semibold" className="text-head text-muted">
                    {env.appVersion}
                  </Text>
                </View>
                <Icon icon={ArrowRightIcon} size={18} color="subtle" />
                <View className="flex-1 items-center gap-1">
                  <Text className="text-meta text-muted">{t('appUpdate.store.latest')}</Text>
                  <Text testID="store-update-latest" mono weight="bold" className="text-head text-primary">
                    {release.version}
                  </Text>
                </View>
              </View>

              <Button testID="store-update-open" className="mt-2 w-full" size="xl" label={t('appUpdate.store.action', { store: storeName })} onPress={openStore} />

              <View className="mt-1 flex-row items-center justify-center gap-1.5">
                <Icon icon={ShieldCheckIcon} size={15} color="success" />
                <Text className="text-sub text-muted">{t('appUpdate.store.keepsData')}</Text>
              </View>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}
