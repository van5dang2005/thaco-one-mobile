import { Image } from 'expo-image';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View, type ViewStyle } from 'react-native';

import { withAlpha } from '@/core/theme/palette';
import { useTheme } from '@/core/theme/ThemeProvider';
import { cn } from '@/shared/lib/cn';
import { CountBadge } from '@/shared/ui/CountBadge';
import { Icon } from '@/shared/ui/Icon';
import { ArrowUpRightIcon, PlusIcon } from '@/shared/ui/icons';
import { Text } from '@/shared/ui/Text';

import type { ModuleSignals } from '../../hooks/useModules';
import { useModuleLabel } from '../../hooks/useModules';
import type { HomeModule, ModuleGroup } from '../../modules';

/** Every layout renders the same filtered modules with the same signals. */
export type LayoutProps = {
  modules: HomeModule[];
  signals: ModuleSignals;
  onOpen: (module: HomeModule) => void;
  /** Show the "Cần xử lý" block (2c tiles / 2g card). */
  showTodo: boolean;
  /** "Tùy chỉnh" / "+ Thêm": arrange the services. */
  onCustomize: () => void;
};

/**
 * Icon box / glyph / deep text colors per group: meeting blue, parcel green (v3), guest amber, document violet. Web apps bring their own logo,
 * mostly on white: a white box with a hairline frames it instead of a tint around a white patch.
 */
export function useGroupTone(group: ModuleGroup) {
  const { colors, scheme } = useTheme();
  const tinted = (box: string) => ({ backgroundColor: box });
  switch (group) {
    case 'meeting':
      return { box: tinted(colors['primary-tint']), icon: colors['primary-tint-text'], bar: colors.primary };
    case 'parcel':
      return { box: tinted(colors['success-tint']), icon: scheme === 'dark' ? colors['success-text'] : colors.success, bar: colors.success };
    case 'guest':
      return { box: tinted(colors['warning-tint']), icon: scheme === 'dark' ? colors['warning-text'] : colors.warning, bar: colors.warning };
    case 'document':
      return { box: tinted(colors['document-tint']), icon: colors.document, bar: colors.document };
    case 'other':
      return { box: { backgroundColor: colors.elevated, borderWidth: 1, borderColor: colors.line }, icon: colors['ink-2'], bar: colors.subtle };
  }
}

/**
 * Dark mode: shadows vanish on the near-black home page, so home cards get a hairline with a lit top
 * edge to read as raised. Light mode keeps the plain card, with the width set to 0 rather than dropped: on Android a
 * removed borderWidth leaves a rounded `overflow-hidden` card (Card) clipping all its content after dark → light.
 */
export function useHomeCardEdge(): ViewStyle {
  const { scheme } = useTheme();
  return scheme === 'dark' ? { borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.08)', borderTopColor: 'rgba(255, 255, 255, 0.17)' } : { borderWidth: 0 };
}

/** Dark mode: a wash of the group color from the card's top-right corner (the header circles, in color). */
export function CardGlow({ color, radius = 20 }: { color: string; radius?: number }) {
  const { scheme } = useTheme();
  if (scheme !== 'dark') return null;
  return (
    <View pointerEvents="none" style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, borderRadius: radius - 1, overflow: 'hidden' }}>
      <View style={{ position: 'absolute', width: 170, height: 170, borderRadius: 85, right: -70, top: -105, backgroundColor: withAlpha(color, 0.14) }} />
      <View style={{ position: 'absolute', width: 84, height: 84, borderRadius: 42, right: 46, top: -52, backgroundColor: withAlpha(color, 0.07) }} />
    </View>
  );
}

/** A module's glyph at `size`: the portal image of a web app (a little larger, logos carry their own margin), else its lucide icon. */
export function ModuleIcon({ module, size, color }: { module: HomeModule; size: number; color: string }) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const url = module.iconUrl;
  if (url && url !== failedUrl) {
    const side = Math.round(size * 1.35);
    return <Image source={{ uri: url }} style={{ width: side, height: side }} contentFit="contain" transition={120} onError={() => setFailedUrl(url)} accessibilityIgnoresInvertColors />;
  }
  return <Icon icon={module.icon} size={size} rawColor={color} />;
}

export function chunk<T>(items: readonly T[], size: number): T[][] {
  const rows: T[][] = [];
  for (let i = 0; i < items.length; i += size) rows.push(items.slice(i, i + size));
  return rows;
}

/** Empty cells that keep the last row of a grid aligned to the columns. */
export function RowPadding({ count }: { count: number }) {
  return Array.from({ length: count }, (_, i) => <View key={`pad-${i}`} className="flex-1" />);
}

/** Red count, or the black ↗ marker for modules that open another app; anchored by `className`. */
export function TileMarker({ module, count, className }: { module: HomeModule; count?: number; className: string }) {
  if (module.externalUrl) {
    return (
      // Padded ring instead of a border, so no dark hairline shows around the disc.
      <View className={cn('absolute h-5 w-5 rounded-full bg-elevated p-0.5', className)}>
        <View className="flex-1 items-center justify-center rounded-full bg-inverse">
          <Icon icon={ArrowUpRightIcon} size={10} weight="bold" color="on-inverse" />
        </View>
      </View>
    );
  }
  return count ? <CountBadge count={count} className={cn('absolute', className)} ring="elevated" /> : null;
}

/** Screen-reader label: "Bưu phẩm, 2" / "Chấm công, mở ứng dụng khác". */
export function useTileA11yLabel() {
  const { t } = useTranslation();
  return (module: HomeModule, label: string, count?: number, summary?: string) =>
    [label, count ? String(count) : null, summary, module.externalUrl ? t('home.opensOtherApp') : null].filter(Boolean).join(', ');
}

export const GRID_COLUMNS = 4;

/** Service tile of the 4-column grids (2c, 2f): 50×50 tinted box (radius 16), 12/500 label, red count. */
export function ModuleTile({ module, count, onOpen }: { module: HomeModule; count?: number; onOpen: (module: HomeModule) => void }) {
  const tone = useGroupTone(module.group);
  const label = useModuleLabel();
  const a11y = useTileA11yLabel();
  return (
    <Pressable
      testID={`home-module-${module.id}`}
      accessibilityRole="button"
      accessibilityLabel={a11y(module, label(module), count)}
      onPress={() => onOpen(module)}
      className="min-h-[44px] min-w-0 flex-1 items-center gap-2 active:opacity-70"
    >
      <View className="h-[50px] w-[50px] items-center justify-center rounded-[16px]" style={tone.box}>
        <ModuleIcon module={module} size={22} color={tone.icon} />
        <TileMarker module={module} count={count} className="-right-1.5 -top-1.5" />
      </View>
      {/* Tile-wide, not text-wide: Android re-lays a re-coloured label (theme switch) a hair narrower than it measured, and "Văn thư" lost "thư". */}
      <Text weight="medium" numberOfLines={2} maxFontSizeMultiplier={1.2} className="self-stretch text-center text-ink" style={{ fontSize: 12, lineHeight: 15 }}>
        {label(module, true)}
      </Text>
    </Pressable>
  );
}

/** Dashed "+ Thêm" tile at the end of the grid: arrange services. */
export function AddTile({ onPress }: { onPress: () => void }) {
  const { t } = useTranslation();
  return (
    <Pressable testID="home-module-add" accessibilityRole="button" accessibilityLabel={t('home.orderSheet.title')} onPress={onPress} className="min-h-[44px] min-w-0 flex-1 items-center gap-2 active:opacity-70">
      <View className="h-[50px] w-[50px] items-center justify-center rounded-[16px] border-[1.5px] border-dashed border-line-strong">
        <Icon icon={PlusIcon} size={20} color="subtle" />
      </View>
      <Text weight="medium" numberOfLines={1} className="text-center text-subtle" style={{ fontSize: 12, lineHeight: 15 }}>
        {t('home.addModule')}
      </Text>
    </Pressable>
  );
}

/** Section title row: "Tiện ích" + an optional link on the right ("Tùy chỉnh", "Xem tất cả"). */
export function SectionHeader({ title, action, onAction, testID }: { title: string; action?: string; onAction?: () => void; testID?: string }) {
  return (
    <View className="flex-row items-center justify-between px-1">
      <Text weight="bold" accessibilityRole="header" className="text-ink" style={{ fontSize: 16, lineHeight: 21 }}>
        {title}
      </Text>
      {action && onAction ? (
        <Pressable testID={testID} accessibilityRole="button" hitSlop={10} onPress={onAction} className="active:opacity-60">
          <Text weight="semibold" className="text-primary" style={{ fontSize: 13, lineHeight: 17 }}>
            {action}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

/** Icon grid in a white card, 4 columns. */
export function ModuleGrid({ modules, signals, onOpen, onAdd }: { modules: HomeModule[]; signals: ModuleSignals; onOpen: (m: HomeModule) => void; onAdd?: () => void }) {
  const cells: (HomeModule | 'add')[] = onAdd ? [...modules, 'add'] : modules;
  return (
    <View style={{ rowGap: 16 }}>
      {chunk(cells, GRID_COLUMNS).map((row, index) => (
        <View key={index} className="flex-row" style={{ columnGap: 4 }}>
          {row.map((cell) =>
            cell === 'add' ? <AddTile key="add" onPress={onAdd!} /> : <ModuleTile key={cell.id} module={cell} count={signals[cell.id]?.badge?.data} onOpen={onOpen} />,
          )}
          <RowPadding count={GRID_COLUMNS - row.length} />
        </View>
      ))}
    </View>
  );
}
