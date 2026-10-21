import { Pressable } from 'react-native';

import { cn } from '@/shared/lib/cn';

import { Icon } from './Icon';
import { ChevronDownIcon, CheckIcon } from './icons';
import { Text } from './Text';

type FilterChipProps = {
  label: string;
  selected?: boolean;
  /** Shows a ▾ to signal that tapping opens a picker. */
  dropdown?: boolean;
  /** `sm`: a lower, tighter chip with smaller text (a row of status tabs). */
  size?: 'md' | 'sm';
  onPress?: () => void;
  testID?: string;
};

/** Filter chip inside a sheet: selected = ink fill, otherwise an outline on the card color. */
export function FilterChip({ label, selected, dropdown, size = 'md', onPress, testID }: FilterChipProps) {
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected }}
      onPress={onPress}
      hitSlop={{ top: 5, bottom: 5 }}
      className={cn(
        'flex-row items-center gap-1.5 rounded-chip active:opacity-80',
        size === 'sm' ? 'h-[30px] px-3' : 'h-[34px] px-3.5',
        selected ? 'bg-inverse' : 'border border-input-border bg-elevated',
      )}
    >
      <Text weight={selected ? 'semibold' : 'medium'} numberOfLines={1} className={cn(size === 'sm' ? 'text-meta' : 'text-sub', selected ? 'text-on-inverse' : 'text-ink-2')}>
        {label}
      </Text>
      {dropdown ? <Icon icon={ChevronDownIcon} size={14} weight="bold" color={selected ? 'on-inverse' : 'muted'} /> : null}
    </Pressable>
  );
}

type ChoiceChipProps = {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  disabled?: boolean;
  /** Strike-through, greyed (taken time slot). */
  struck?: boolean;
  mono?: boolean;
  className?: string;
  testID?: string;
};

/** Multi-select chip (services) and time-slot chip (extend meeting). */
export function ChoiceChip({ label, selected, onPress, disabled, struck, mono, className, testID }: ChoiceChipProps) {
  return (
    <Pressable
      testID={testID}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: !!selected, disabled: !!(disabled || struck) }}
      disabled={disabled || struck}
      onPress={onPress}
      className={cn(
        'h-[34px] flex-row items-center justify-center gap-1.5 rounded-[10px] px-3',
        struck ? 'bg-disabled' : selected ? 'border-[1.5px] border-primary bg-primary-tint' : 'border border-input-border',
        disabled && !struck && 'opacity-50',
        className,
      )}
    >
      {selected && !mono ? <Icon icon={CheckIcon} size={13} weight="bold" color="primary-tint-text" /> : null}
      <Text
        mono={mono}
        weight={selected ? 'semibold' : mono ? 'medium' : 'regular'}
        className={cn('text-sub', struck ? 'text-disabled-text line-through' : selected ? 'text-primary-tint-text' : 'text-ink')}
      >
        {label}
      </Text>
    </Pressable>
  );
}
