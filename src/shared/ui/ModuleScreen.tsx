import { cloneElement, isValidElement, type ReactNode, type Ref } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View, type ScrollViewProps } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '@/core/theme/ThemeProvider';

import { shadows } from './shadows';

/** Padding and gap of the scrolling content (v3: 12 top, 16 sides, cards 12 apart). */
export const CONTENT_PADDING = { horizontal: 16, top: 12, bottom: 24, gap: 12 } as const;

type Props = {
  /** A `ModuleHeader`. */
  header: ReactNode;
  /** Floating card over the bottom of the header (`FloatingCard`: stats, tabs). Stays put while the content scrolls. */
  floating?: ReactNode;
  children: ReactNode;
  /** Sticky action bar (`BottomBar` content): laid out in a row, 10 apart. */
  footer?: ReactNode;
  /** Above the footer row (error banner, summary). */
  footerNote?: ReactNode;
  /** `canvas` #EDF1F6 (default), `home` #F2F4F8, `elevated` white (one white panel under a header that draws its own background). */
  background?: 'canvas' | 'home' | 'elevated';
  /** Wrap children in a ScrollView with `CONTENT_PADDING` (default). `false` when the screen renders its own list. */
  scroll?: boolean;
  refreshControl?: ScrollViewProps['refreshControl'];
  scrollRef?: Ref<ScrollView>;
  /** Over the content (floating selection bar). */
  overlay?: ReactNode;
  /**
   * The floating card scrolls with the content (tall summaries on detail screens): it sits on a 26pt
   * blue band at the top of the scroll view, so pass the header a smaller `bottom` (18). The band stays
   * joined to the header: pulling down stretches the blue instead of opening a gap under the header.
   */
  floatingScrolls?: boolean;
  /**
   * The first content card overlaps the header (lists whose cards start on the blue, 6f / 6g): a 26pt
   * blue band sits behind the top of the scroll content, so pass the header a smaller `bottom` (18).
   */
  overlap?: boolean;
  testID?: string;
};

/** One module screen of the v3 design: blue header, optional floating card, scrolling content, optional action bar. */
export function ModuleScreen({ header, floating, children, footer, footerNote, background = 'canvas', scroll = true, refreshControl, scrollRef, overlay, floatingScrolls, overlap, testID }: Props) {
  const { colors } = useTheme();
  const bg = background === 'elevated' ? colors.elevated : background === 'home' ? colors['home-bg'] : colors.canvas;

  if (floatingScrolls) {
    // The scroll view's own background is the header blue, so the pull-down area above the band is blue
    // (with a light spinner); the content keeps the canvas, also past its end when it bounces.
    const banded = !!floating;
    return (
      <KeyboardAvoidingView testID={testID} behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1" style={{ backgroundColor: bg }}>
        {header}
        <View className="flex-1">
          <ScrollView
            ref={scrollRef}
            keyboardShouldPersistTaps="handled"
            refreshControl={banded && isValidElement(refreshControl) ? cloneElement(refreshControl, { tintColor: colors['header-name'] }) : refreshControl}
            style={banded ? { backgroundColor: colors.header } : undefined}
            contentContainerStyle={{ flexGrow: 1, paddingBottom: CONTENT_PADDING.bottom, backgroundColor: bg }}
          >
            {banded ? (
              <>
                <View style={{ height: 26, backgroundColor: colors.header }} />
                <View style={{ zIndex: 1 }}>{floating}</View>
              </>
            ) : null}
            <View style={{ paddingHorizontal: CONTENT_PADDING.horizontal, paddingTop: CONTENT_PADDING.top, gap: CONTENT_PADDING.gap }}>{children}</View>
            {banded ? <View pointerEvents="none" style={{ position: 'absolute', top: '100%', left: 0, right: 0, height: 800, backgroundColor: bg }} /> : null}
          </ScrollView>
          {overlay}
        </View>
        {footer ? <BottomBar note={footerNote}>{footer}</BottomBar> : null}
      </KeyboardAvoidingView>
    );
  }

  return (
    <KeyboardAvoidingView testID={testID} behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1" style={{ backgroundColor: bg }}>
      {header}
      {floating ? <View style={{ zIndex: 1 }}>{floating}</View> : null}
      <View className="flex-1">
        {scroll ? (
          <ScrollView
            ref={scrollRef}
            keyboardShouldPersistTaps="handled"
            // Overlap: as with `floatingScrolls`, the scroll view itself is header blue so pulling down stretches
            // the band (light spinner) instead of dragging it away from the header; the content keeps the canvas.
            refreshControl={overlap && isValidElement(refreshControl) ? cloneElement(refreshControl, { tintColor: colors['header-name'] }) : refreshControl}
            style={overlap ? { backgroundColor: colors.header } : undefined}
            contentContainerStyle={{
              paddingHorizontal: CONTENT_PADDING.horizontal,
              paddingTop: overlap ? 0 : CONTENT_PADDING.top,
              paddingBottom: CONTENT_PADDING.bottom,
              gap: CONTENT_PADDING.gap,
              ...(overlap ? { flexGrow: 1, backgroundColor: bg } : null),
            }}
          >
            {overlap ? <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 26, backgroundColor: colors.header }} /> : null}
            {children}
            {overlap ? <View pointerEvents="none" style={{ position: 'absolute', top: '100%', left: 0, right: 0, height: 800, backgroundColor: bg }} /> : null}
          </ScrollView>
        ) : (
          children
        )}
        {overlay}
      </View>
      {footer ? <BottomBar note={footerNote}>{footer}</BottomBar> : null}
    </KeyboardAvoidingView>
  );
}

/** White action bar at the bottom: top corners 24, upward shadow, padding 14/16 + safe area. */
export function BottomBar({ children, note }: { children: ReactNode; note?: ReactNode }) {
  const insets = useSafeAreaInsets();
  const { scheme, colors } = useTheme();
  return (
    <View
      className="gap-2.5 rounded-t-[24px] bg-elevated px-4 pt-3.5"
      style={[shadows.footer, { paddingBottom: Math.max(insets.bottom, 12) + 2 }, scheme === 'dark' ? { borderTopWidth: 1, borderColor: colors.line } : null]}
    >
      {note}
      <View className="flex-row items-center gap-2.5">{children}</View>
    </View>
  );
}
