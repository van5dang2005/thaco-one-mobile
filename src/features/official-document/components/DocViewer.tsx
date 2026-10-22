import type { Directory, File } from 'expo-file-system';
import { startActivityAsync } from 'expo-intent-launcher';
import * as WebBrowser from 'expo-web-browser';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Platform, View } from 'react-native';
import Pdf from 'react-native-pdf';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';

import { useTheme } from '@/core/theme/ThemeProvider';
import { Button } from '@/shared/ui/Button';
import { ExternalLinkIcon } from '@/shared/ui/icons';
import { Text } from '@/shared/ui/Text';
import { toast } from '@/shared/ui/Toast';

import type { FileKind } from '../types';
import { mimeOf, officeFormat, type OfficeFormat } from '../utils/files';
import { FileKindTile } from './FileRow';
import { OfficeView } from './office/OfficeView';

type Props = {
  file: File;
  /** The download's own folder: the iOS web view may read only there. */
  folder: Directory;
  name: string;
  kind: FileKind;
  onError: (error: unknown) => void;
};

const FLAG_GRANT_READ_URI_PERMISSION = 1;

/**
 * A downloaded document inside the app. iOS: the system web view renders PDF, Word, Excel and PowerPoint. Android:
 * PDFs in react-native-pdf with a page counter; .docx / .xlsx / .xls / .csv in an on-phone web renderer
 * (`OfficeView`); anything else (PowerPoint, old .doc, archives…), or a file that renderer cannot read, gets a card
 * that offers another app.
 */
export function DocViewer({ file, folder, name, kind, onError }: Props) {
  const { colors } = useTheme();

  if (Platform.OS === 'ios') {
    return (
      <WebView
        testID="doc-viewer"
        source={{ uri: file.uri }}
        originWhitelist={['*']}
        allowingReadAccessToURL={folder.uri}
        style={{ flex: 1, backgroundColor: colors.canvas }}
        containerStyle={{ backgroundColor: colors.canvas }}
        onShouldStartLoadWithRequest={({ url }) => {
          if (url.startsWith('file:') || url === 'about:blank') return true;
          // A link inside the document opens over the viewer instead of replacing it.
          void WebBrowser.openBrowserAsync(url);
          return false;
        }}
        onError={({ nativeEvent }) => onError(new Error(nativeEvent.description))}
      />
    );
  }

  if (kind === 'pdf') return <PdfPages file={file} onError={onError} />;
  const format = officeFormat(name);
  if (format) return <AndroidOffice file={file} name={name} kind={kind} format={format} />;
  return <NoPreview file={file} name={name} kind={kind} />;
}

/** The Office renderer, or the "open with" card once it reports it could not read the file. */
function AndroidOffice({ file, name, kind, format }: { file: File; name: string; kind: FileKind; format: OfficeFormat }) {
  const [failed, setFailed] = useState(false);
  if (failed) return <NoPreview file={file} name={name} kind={kind} failed />;
  return <OfficeView file={file} format={format} onFail={() => setFailed(true)} />;
}

function PdfPages({ file, onError }: { file: File; onError: (error: unknown) => void }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [page, setPage] = useState({ current: 1, count: 0 });
  return (
    <View className="flex-1" testID="doc-viewer">
      <Pdf
        source={{ uri: file.uri }}
        trustAllCerts={false}
        spacing={8}
        style={{ flex: 1, backgroundColor: colors.canvas }}
        onLoadComplete={(count) => setPage({ current: 1, count })}
        onPageChanged={(current, count) => setPage({ current, count })}
        onPressLink={(url) => void WebBrowser.openBrowserAsync(url)}
        onError={onError}
      />
      {page.count === 0 ? (
        // pdfium takes a moment to start on a cold open; the canvas would look empty until the first page draws.
        <View pointerEvents="none" className="absolute inset-0 items-center justify-center">
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : null}
      {page.count > 1 ? (
        <View pointerEvents="none" className="absolute left-0 right-0 items-center" style={{ bottom: insets.bottom + 16 }}>
          <View className="rounded-full px-3 py-1.5" style={{ backgroundColor: colors.inverse, opacity: 0.86 }}>
            <Text mono weight="semibold" style={{ fontSize: 12.5, lineHeight: 16, color: colors['on-inverse'] }}>
              {page.current} / {page.count}
            </Text>
          </View>
        </View>
      ) : null}
    </View>
  );
}

/** Android, no in-app renderer for this file: the user picks another app on purpose instead of being sent there (sharing stays on the header). */
function NoPreview({ file, name, kind, failed }: { file: File; name: string; kind: FileKind; failed?: boolean }) {
  const { t } = useTranslation();
  const openWith = async () => {
    try {
      await startActivityAsync('android.intent.action.VIEW', { data: file.contentUri, type: mimeOf(file.name) ?? (file.type || '*/*'), flags: FLAG_GRANT_READ_URI_PERMISSION });
    } catch {
      toast.info(t('documents.viewer.noApp'));
    }
  };
  return (
    <View className="flex-1 items-center justify-center gap-4 px-8" testID="doc-viewer-no-preview">
      <FileKindTile kind={kind} size={72} />
      <View className="gap-1.5">
        <Text weight="semibold" numberOfLines={2} className="text-center" style={{ fontSize: 15, lineHeight: 21 }}>
          {name}
        </Text>
        <Text className="text-center text-muted" style={{ fontSize: 13, lineHeight: 19 }}>
          {failed ? t('documents.viewer.renderFailed') : t('documents.viewer.noPreview', { kind: t(`documents.fileKind.${kind}`) })}
        </Text>
      </View>
      <Button testID="doc-viewer-open-with" className="w-full max-w-[400px]" icon={ExternalLinkIcon} label={t('documents.viewer.openWith')} onPress={() => void openWith()} />
    </View>
  );
}
