import * as Sharing from 'expo-sharing';
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, View } from 'react-native';

import { useTheme } from '@/core/theme/ThemeProvider';
import { Button } from '@/shared/ui/Button';
import { HeaderIconButton } from '@/shared/ui/HeaderBar';
import { Icon } from '@/shared/ui/Icon';
import { CircleAlertIcon, FileTextIcon, Share2Icon } from '@/shared/ui/icons';
import { ModuleHeader } from '@/shared/ui/ModuleHeader';
import { ModuleScreen } from '@/shared/ui/ModuleScreen';
import { Text } from '@/shared/ui/Text';

import { DocViewer } from '../components/DocViewer';
import { useDocFileDownload } from '../hooks/useDocFileDownload';
import type { FileKind } from '../types';
import { mimeOf } from '../utils/files';

type Params = { url: string; name: string; kind?: FileKind; meta?: string; share?: '1' };

/** One document file inside the app (`useOpenDocFile`): downloaded to the cache, shown under the Văn thư header. */
export function DocumentFileScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { url = '', name = '', kind = 'other', meta, share } = useLocalSearchParams<Params>();
  const download = useDocFileDownload(url, name, kind);
  // The viewer could not render the downloaded file: same error card, and "Thử lại" downloads it again.
  const [unreadable, setUnreadable] = useState(false);
  const ready = download.status === 'ready' && !unreadable ? download : undefined;
  const retry = () => {
    setUnreadable(false);
    download.retry();
  };

  const onShare = ready && share === '1' ? () => void Sharing.shareAsync(ready.file.uri, { dialogTitle: name, mimeType: mimeOf(ready.file.name) ?? (ready.file.type || undefined) }) : undefined;

  return (
    <ModuleScreen
      testID="doc-file-screen"
      scroll={false}
      header={
        <ModuleHeader
          testID="doc-file-header"
          icon={FileTextIcon}
          title={name}
          subtitle={meta}
          bottom={14}
          right={onShare ? <HeaderIconButton testID="doc-file-share" icon={Share2Icon} label={t('documents.viewer.share')} onPress={onShare} /> : null}
        />
      }
    >
      {ready ? (
        <DocViewer file={ready.file} folder={ready.folder} name={name} kind={kind} onError={() => setUnreadable(true)} />
      ) : download.status === 'error' || unreadable ? (
        <View className="flex-1 items-center justify-center gap-3 px-8" testID="doc-file-error">
          <Icon icon={CircleAlertIcon} size={26} color="danger" />
          <Text className="text-center text-body text-ink-2">{t('documents.viewer.loadFailed')}</Text>
          <Button label={t('common.retry')} size="sm" variant="ghost" onPress={retry} />
        </View>
      ) : (
        <View className="flex-1 items-center justify-center gap-3" testID="doc-file-loading">
          <ActivityIndicator color={colors.primary} />
          <Text className="text-muted" style={{ fontSize: 13, lineHeight: 18 }}>
            {t('documents.viewer.loading')}
          </Text>
        </View>
      )}
    </ModuleScreen>
  );
}
