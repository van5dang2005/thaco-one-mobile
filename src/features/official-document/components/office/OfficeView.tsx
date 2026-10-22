import type { File } from 'expo-file-system';
import { useCallback, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, View } from 'react-native';

import { useTheme } from '@/core/theme/ThemeProvider';
import { Text } from '@/shared/ui/Text';

import type { OfficeFormat } from '../../utils/files';
import DocxPages from './DocxPages';
import type { OfficeColors } from './receive';
import SheetTabs from './SheetTabs';

/** Base64 characters per bridge message (a multiple of 4, so every chunk decodes on its own). */
const CHUNK = 1024 * 1024;

/**
 * Android, Word / Excel: a DOM component (web view) renders the downloaded file on the phone, nothing
 * leaves it. The file goes over in base64 chunks the web side asks for; a native cover shows progress until the
 * first pages are drawn.
 */
export function OfficeView({ file, format, onFail }: { file: File; format: OfficeFormat; onFail: (error: unknown) => void }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const [progress, setProgress] = useState(0);
  const [ready, setReady] = useState(false);
  const base64 = useRef<Promise<string> | null>(null);

  const size = file.size;
  const chunks = Math.max(1, Math.ceil((4 * Math.ceil(size / 3)) / CHUNK));
  const readChunk = useCallback(
    async (index: number) => {
      // Encoded once, natively; the web side asks for it piece by piece.
      base64.current ??= file.base64();
      const all = await base64.current;
      return all.slice(index * CHUNK, (index + 1) * CHUNK);
    },
    [file],
  );
  const onProgress = useCallback(async (percent: number) => setProgress(percent), []);
  const onReady = useCallback(async () => {
    base64.current = null;
    setReady(true);
  }, []);
  const onRenderFail = useCallback(async (message: string) => onFail(new Error(message)), [onFail]);

  const palette = useMemo<OfficeColors>(
    () => ({
      canvas: colors.canvas,
      surface: colors.surface,
      ink: colors.ink,
      muted: colors.muted,
      line: colors.line,
      primary: colors.primary,
      onPrimary: colors['on-primary'],
    }),
    [colors],
  );
  const dom = useMemo(
    () => ({
      style: { flex: 1 },
      setDisplayZoomControls: false,
      // The web view itself failed (no bundle, crashed renderer): the same fallback as a file it cannot read.
      onError: () => onFail(new Error('web view failed')),
    }),
    [onFail],
  );
  const shared = { fileUri: file.uri, size, chunks, readChunk, onProgress, onReady, onFail: onRenderFail, colors: palette, dom };

  return (
    <View className="flex-1" testID={`doc-viewer-${format}`}>
      {format === 'docx' ? (
        <DocxPages {...shared} />
      ) : (
        <SheetTabs {...shared} labels={{ more: t('documents.viewer.moreRows', { shown: '%SHOWN%', total: '%TOTAL%' }), loadingMore: t('documents.viewer.loadingRows'), empty: t('documents.viewer.emptySheet') }} />
      )}
      {!ready ? (
        <View className="absolute inset-0 items-center justify-center gap-3" style={{ backgroundColor: colors.canvas }}>
          <ActivityIndicator color={colors.primary} />
          <Text className="text-muted" style={{ fontSize: 13, lineHeight: 18 }}>
            {progress < 100 ? t('documents.viewer.opening', { percent: progress }) : t('documents.viewer.rendering')}
          </Text>
        </View>
      ) : null}
    </View>
  );
}
