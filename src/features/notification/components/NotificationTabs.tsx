import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import { useTheme } from '@/core/theme/ThemeProvider';
import { floatShadow, useCardStyle } from '@/shared/ui/Card';
import { Icon } from '@/shared/ui/Icon';
import { type AppIcon, ChevronLeftIcon, ChevronRightIcon } from '@/shared/ui/icons';
import { Text } from '@/shared/ui/Text';

import type { NotificationAccent } from '../types';

/** `all`: the merged feed, with the header picture's colours; the modules keep their Home tile colour. */
export type TabAccent = NotificationAccent | 'all';

export type NotificationTab = { value: string; label: string; icon: AppIcon; accent: TabAccent; unread: number; testID?: string };

type Props = { tabs: NotificationTab[]; value: string; onChange: (value: string) => void };

type Accent = {
  /** Disc behind the glyph while not selected. */
  tint: string;
  glyph: string;
  /** Selected pill: one colour, or a left-to-right gradient. */
  fill: string | [string, string];
  /** Label on the selected pill. */
  onFill: string;
  /** Glow under the selected pill. */
  glow?: string;
};

/**
 * "Tất cả" is the bell of the header picture: a gold bell, on a blue-to-indigo pill (the sky running into the
 * document violet) when selected, so it reads as every module together rather than one of them.
 */
const ALL_ACCENT: Record<'light' | 'dark', Accent> = {
  light: { tint: '#FFF1D2', glyph: '#E0940C', fill: ['#2A7BE8', '#5B45DB'], onFill: '#FFFFFF', glow: 'rgba(66, 86, 224, 0.35)' },
  dark: { tint: '#3A2A10', glyph: '#F2B84B', fill: ['#3577DE', '#6450E2'], onFill: '#FFFFFF', glow: 'rgba(80, 100, 240, 0.3)' },
};

function useAccent(accent: TabAccent): Accent {
  const { colors, scheme } = useTheme();
  const solid = (tint: string, color: string): Accent => ({ tint, glyph: color, fill: color, onFill: colors.elevated });
  switch (accent) {
    case 'meeting':
      return solid(colors['primary-tint'], colors.primary);
    case 'parcel':
      return solid(colors['success-tint'], scheme === 'dark' ? colors['success-text'] : colors.success);
    case 'document':
      return solid(colors['document-tint'], colors.document);
    case 'all':
      return ALL_ACCENT[scheme];
  }
}

/**
 * The notification modules as one floating card over the header's foot, holding a row of pills that scrolls
 * sideways, so any number of modules fits: each pill is the module's icon in its colour, its name and a red unread
 * count. The selected pill fills with the module's colour and scrolls itself into view. While pills hide past an
 * edge, that edge fades out under a round chevron (a tap scrolls a page that way).
 */
export function NotificationTabs({ tabs, value, onChange }: Props) {
  const chrome = useCardStyle();
  const scroll = useRef<ScrollView>(null);
  const spots = useRef<Record<string, { x: number; width: number }>>({});
  const [viewport, setViewport] = useState(0);
  const [content, setContent] = useState(0);
  const [offset, setOffset] = useState(0);
  const more = { left: offset > 2, right: offset + viewport < content - 2 };
  const page = (direction: 1 | -1) =>
    scroll.current?.scrollTo({ x: Math.min(Math.max(0, offset + direction * viewport * 0.7), Math.max(0, content - viewport)), animated: true });

  // Centre the selected pill when it changes (or once the row is measured), as far as the row can scroll.
  useEffect(() => {
    const spot = spots.current[value];
    if (spot && viewport) scroll.current?.scrollTo({ x: Math.max(0, spot.x - (viewport - spot.width) / 2), animated: true });
  }, [value, viewport]);

  return (
    <View className="mx-4 overflow-hidden rounded-card" style={chrome}>
      <ScrollView
        ref={scroll}
        horizontal
        showsHorizontalScrollIndicator={false}
        accessibilityRole="tablist"
        onLayout={(event) => setViewport(event.nativeEvent.layout.width)}
        onContentSizeChange={(width) => setContent(width)}
        onScroll={(event) => setOffset(event.nativeEvent.contentOffset.x)}
        scrollEventThrottle={32}
        contentContainerStyle={{ padding: 6, gap: 4 }}
      >
        {tabs.map((tab) => (
          <Tab
            key={tab.value}
            tab={tab}
            selected={tab.value === value}
            onPress={() => onChange(tab.value)}
            onLayout={(x, width) => {
              spots.current[tab.value] = { x, width };
            }}
          />
        ))}
      </ScrollView>
      {more.left ? <EdgeCue side="left" onPress={() => page(-1)} /> : null}
      {more.right ? <EdgeCue side="right" onPress={() => page(1)} /> : null}
    </View>
  );
}

/** More pills past this edge: the row fades into the card under a small round chevron. */
function EdgeCue({ side, onPress }: { side: 'left' | 'right'; onPress: () => void }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const left = side === 'left';
  const id = `ntFade_${side}`;
  return (
    <View pointerEvents="box-none" className="absolute bottom-0 top-0 w-14 justify-center" style={[left ? { left: 0 } : { right: 0 }, { alignItems: left ? 'flex-start' : 'flex-end' }]}>
      <Svg pointerEvents="none" style={StyleSheet.absoluteFill}>
        <Defs>
          <LinearGradient id={id} x1={left ? '1' : '0'} y1="0" x2={left ? '0' : '1'} y2="0">
            <Stop offset="0" stopColor={colors.elevated} stopOpacity={0} />
            <Stop offset="0.5" stopColor={colors.elevated} stopOpacity={0.85} />
            <Stop offset="1" stopColor={colors.elevated} />
          </LinearGradient>
        </Defs>
        <Rect width="100%" height="100%" fill={`url(#${id})`} />
      </Svg>
      <Pressable
        testID={`notifications-tabs-${side}`}
        accessibilityRole="button"
        accessibilityLabel={t(left ? 'notifications.tabsPrev' : 'notifications.tabsNext')}
        onPress={onPress}
        hitSlop={8}
        className="mx-1.5 h-7 w-7 items-center justify-center rounded-full active:opacity-70"
        style={[floatShadow, { backgroundColor: colors['primary-tint'] }]}
      >
        <Icon icon={left ? ChevronLeftIcon : ChevronRightIcon} size={16} weight="bold" rawColor={colors['primary-tint-text']} />
      </Pressable>
    </View>
  );
}

type TabProps = { tab: NotificationTab; selected: boolean; onPress: () => void; onLayout: (x: number, width: number) => void };

function Tab({ tab, selected, onPress, onLayout }: TabProps) {
  const { colors } = useTheme();
  const { tint, glyph, fill, onFill, glow } = useAccent(tab.accent);
  const gradient = typeof fill === 'string' ? null : fill;
  const id = `ntPill_${tab.accent}`;
  return (
    <Pressable
      testID={tab.testID}
      accessibilityRole="tab"
      accessibilityState={{ selected }}
      accessibilityLabel={tab.unread ? `${tab.label}, ${tab.unread}` : tab.label}
      onPress={onPress}
      onLayout={(event) => onLayout(event.nativeEvent.layout.x, event.nativeEvent.layout.width)}
      className="h-10 flex-row items-center gap-2 rounded-full pl-1.5 pr-3 active:opacity-70"
      style={[{ backgroundColor: selected && !gradient ? (fill as string) : 'transparent' }, selected && glow ? { boxShadow: `0px 2px 6px ${glow}` } : null]}
    >
      {selected && gradient ? (
        <Svg pointerEvents="none" style={StyleSheet.absoluteFill}>
          <Defs>
            <LinearGradient id={id} x1="0" y1="0" x2="1" y2="0.4">
              <Stop offset="0" stopColor={gradient[0]} />
              <Stop offset="1" stopColor={gradient[1]} />
            </LinearGradient>
          </Defs>
          <Rect width="100%" height="100%" rx={20} fill={`url(#${id})`} />
        </Svg>
      ) : null}
      <View className="h-7 w-7 items-center justify-center rounded-full" style={{ backgroundColor: selected ? '#FFFFFF' : tint }}>
        <Icon icon={tab.icon} size={15} rawColor={glyph} />
      </View>
      <Text weight={selected ? 'bold' : 'semibold'} numberOfLines={1} maxFontSizeMultiplier={1.2} style={{ fontSize: 13.5, lineHeight: 18, color: selected ? onFill : colors['ink-2'] }}>
        {tab.label}
      </Text>
      {tab.unread ? (
        <View className="h-[18px] min-w-[18px] items-center justify-center rounded-full px-1.5" style={{ backgroundColor: colors.danger }}>
          <Text mono weight="bold" maxFontSizeMultiplier={1} style={{ fontSize: 10.5, lineHeight: 13, color: '#FFFFFF' }}>
            {tab.unread > 99 ? '99+' : String(tab.unread)}
          </Text>
        </View>
      ) : null}
    </Pressable>
  );
}
