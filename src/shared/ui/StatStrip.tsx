import { Fragment } from 'react';
import { Pressable, View } from 'react-native';

import { cn } from '@/shared/lib/cn';

import { Icon } from './Icon';
import type { AppIcon } from './icons';
import { useToneColors, type Tone } from './tones';
import { Text } from './Text';

export type StatItem = {
  key: string;
  icon: AppIcon;
  tone: Tone;
  value: string | number;
  label: string;
  /** Color the value with the tone's solid color (e.g. the current time in red). */
  emphasize?: boolean;
  onPress?: () => void;
  testID?: string;
};

/**
 * Three (or more) stats in a row, split by 1px #EEF2F6 lines: a 30pt tinted square icon (radius 9),
 * the value in mono 17/700 and an 11px muted label. Usually inside a `FloatingCard`.
 */
export function StatStrip({ items, className, testID }: { items: StatItem[]; className?: string; testID?: string }) {
  return (
    <View testID={testID} className={cn('flex-row items-stretch px-1 py-2.5', className)}>
      {items.map((item, index) => (
        <Fragment key={item.key}>
          {index > 0 ? <View className="my-1 w-px bg-line-2" /> : null}
          <StatCell item={item} />
        </Fragment>
      ))}
    </View>
  );
}

function StatCell({ item }: { item: StatItem }) {
  const tone = useToneColors(item.tone);
  const content = (
    <>
      <View className="h-[30px] w-[30px] items-center justify-center rounded-[9px]" style={{ backgroundColor: tone.tint }}>
        <Icon icon={item.icon} size={16} rawColor={tone.solid} />
      </View>
      <View className="min-w-0 flex-shrink">
        <Text mono weight="bold" numberOfLines={1} maxFontSizeMultiplier={1.2} className={item.emphasize ? undefined : 'text-ink'} style={{ fontSize: 17, lineHeight: 21, color: item.emphasize ? tone.solid : undefined }}>
          {String(item.value)}
        </Text>
        <Text numberOfLines={1} maxFontSizeMultiplier={1.2} className="text-muted" style={{ fontSize: 11, lineHeight: 14 }}>
          {item.label}
        </Text>
      </View>
    </>
  );
  const box = 'min-w-0 flex-1 flex-row items-center gap-2 px-2';
  return item.onPress ? (
    <Pressable testID={item.testID} accessibilityRole="button" accessibilityLabel={`${item.label}: ${item.value}`} onPress={item.onPress} className={cn(box, 'active:opacity-70')}>
      {content}
    </Pressable>
  ) : (
    <View testID={item.testID} accessible accessibilityLabel={`${item.label}: ${item.value}`} className={box}>
      {content}
    </View>
  );
}
