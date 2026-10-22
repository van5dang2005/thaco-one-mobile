import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { useTheme } from '@/core/theme/ThemeProvider';
import { cn } from '@/shared/lib/cn';
import { Icon } from '@/shared/ui/Icon';
import { ChevronRightIcon } from '@/shared/ui/icons';
import { Text } from '@/shared/ui/Text';

import type { DocFile, FileKind } from '../types';

/** One file: a 40×40 type tile (PDF / DOC / XLS / PPT), the name, then description and size. */
export function FileRow({ file, onPress, trailing, className, testID }: { file: DocFile; onPress?: () => void; trailing?: ReactNode; className?: string; testID?: string }) {
  const { t } = useTranslation();
  const meta = [file.description, file.pages ? t('documents.filePages', { count: file.pages }) : null, file.size].filter(Boolean).join(' · ');

  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={`${file.name}, ${meta}`}
      disabled={!onPress}
      onPress={onPress}
      className={cn('min-h-[52px] flex-row items-center gap-3 active:opacity-70', className)}
    >
      <FileKindTile kind={file.kind} />
      <View className="min-w-0 flex-1 gap-0.5">
        <Text weight="semibold" numberOfLines={1} style={{ fontSize: 14, lineHeight: 19 }}>
          {file.name}
        </Text>
        <Text numberOfLines={1} className="text-muted" style={{ fontSize: 12, lineHeight: 16 }}>
          {meta}
        </Text>
      </View>
      {trailing ?? (onPress ? <Icon icon={ChevronRightIcon} size={16} color="subtle" /> : null)}
    </Pressable>
  );
}

/** The type tile (PDF red, DOC blue, XLS green, PPT orange): 40 in rows, larger on the viewer's no-preview card. */
export function FileKindTile({ kind, size = 40 }: { kind: FileKind; size?: number }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const tile = {
    pdf: { bg: colors['danger-tint'], fg: colors['danger-text'] },
    doc: { bg: colors['primary-tint'], fg: colors['primary-tint-text'] },
    xls: { bg: colors['success-tint'], fg: colors['success-text'] },
    ppt: { bg: colors['warning-tint'], fg: colors['warning-text'] },
    other: { bg: colors['off-tint'], fg: colors['off-text'] },
  }[kind];
  const scale = size / 40;
  return (
    <View className="items-center justify-center" style={{ width: size, height: size, borderRadius: 10 * scale, backgroundColor: tile.bg }}>
      <Text mono weight="bold" maxFontSizeMultiplier={1} style={{ fontSize: 10.5 * scale, lineHeight: 13 * scale, color: tile.fg }}>
        {t(`documents.fileKind.${kind}`)}
      </Text>
    </View>
  );
}
