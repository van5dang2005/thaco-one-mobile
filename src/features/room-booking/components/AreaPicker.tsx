import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { qk } from '@/core/query/keys';
import { sameId } from '@/core/session/userTypes';
import { useTheme } from '@/core/theme/ThemeProvider';
import { cn } from '@/shared/lib/cn';
import { BottomSheet } from '@/shared/ui/BottomSheet';
import { Icon } from '@/shared/ui/Icon';
import { BuildingIcon, CheckIcon, MapPinIcon } from '@/shared/ui/icons';
import { RoundIcon } from '@/shared/ui/RoundIcon';
import { Text } from '@/shared/ui/Text';

import { roomsApi } from '../api/room.api';
import { useAreas } from '../hooks/useAreas';
import { rememberArea } from '../hooks/useDefaultAreaId';
import { useRoomConnected } from '../hooks/useRoomConnected';

/** Active rooms per area (lower-cased area id), from every room (get-all-rooms without an area); only while the sheet is open. */
function useRoomCounts(enabled: boolean) {
  const connected = useRoomConnected();
  return useQuery({
    queryKey: qk.rooms.list(),
    queryFn: () => roomsApi.rooms(),
    enabled: enabled && connected,
    staleTime: 5 * 60 * 1000,
    select: (rooms) => {
      const counts: Record<string, number> = {};
      rooms.forEach((r) => {
        if (r.isActive !== false && r.areaId) counts[r.areaId.toLowerCase()] = (counts[r.areaId.toLowerCase()] ?? 0) + 1;
      });
      return counts;
    },
  });
}

/**
 * Area of a module header ("📍 VĂN PHÒNG SOFIC ⌄"): the area name, a function that opens the area sheet
 * (GET /api/areas) and the sheet element to render. Choosing an area also remembers it.
 *
 * The sheet lists each area on one 44pt line: a building tile, the name, how many meeting rooms it has, and a radio;
 * the chosen one is tinted blue with a solid tile and a check. Ten areas fit without scrolling.
 */
export function useAreaPicker(areaId: string | undefined, onChange: (areaId: string) => void, testID?: string) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const areas = useAreas();
  const [open, setOpen] = useState(false);
  const counts = useRoomCounts(open);
  const list = areas.data ?? [];
  const area = list.find((a) => sameId(a.id, areaId));

  const sheet = (
    <BottomSheet
      testID={testID ? `${testID}-sheet` : undefined}
      visible={open}
      onClose={() => setOpen(false)}
      title={t('rooms.chooseArea')}
      subtitle={list.length ? t('rooms.areaCount', { count: list.length }) : undefined}
      icon={MapPinIcon}
      iconTone="brand"
      compact
      scrollable
      maxHeightRatio={0.72}
    >
      <View className="gap-1">
        {list.map((a, index) => {
          const selected = sameId(a.id, areaId);
          const rooms = counts.data?.[a.id.toLowerCase()];
          return (
            <Pressable
              key={a.id}
              testID={testID ? `${testID}-sheet-${index}` : undefined}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              accessibilityLabel={rooms ? `${a.name}, ${t('rooms.areaRooms', { count: rooms })}` : a.name}
              onPress={() => {
                rememberArea(a.id);
                onChange(a.id);
                setOpen(false);
              }}
              className={cn('h-11 flex-row items-center gap-2.5 rounded-[12px] pl-1.5 pr-3 active:opacity-70', selected ? 'bg-primary-tint' : 'bg-elevated')}
              // The border keeps its width and only changes colour (a conditional border blanks rounded views on Android).
              style={{ borderWidth: 1, borderColor: selected ? colors.primary : colors.line }}
            >
              <RoundIcon icon={BuildingIcon} size={30} tone={selected ? 'solid' : 'brand'} square />
              <Text weight={selected ? 'bold' : 'semibold'} numberOfLines={1} className="min-w-0 flex-1 text-ink" style={{ fontSize: 13, lineHeight: 17 }}>
                {a.name}
              </Text>
              {rooms ? (
                <Text numeric weight={selected ? 'semibold' : 'regular'} numberOfLines={1} className={selected ? 'text-primary' : 'text-muted'} style={{ fontSize: 11.5, lineHeight: 15 }}>
                  {t('rooms.areaRooms', { count: rooms })}
                </Text>
              ) : null}
              {selected ? (
                <View className="h-[18px] w-[18px] items-center justify-center rounded-full bg-primary">
                  <Icon icon={CheckIcon} size={11} weight="bold" color="on-primary" />
                </View>
              ) : (
                <View className="h-[18px] w-[18px] rounded-full" style={{ borderWidth: 1.5, borderColor: colors['input-border'] }} />
              )}
            </Pressable>
          );
        })}
      </View>
    </BottomSheet>
  );

  return { name: area?.name ?? t('rooms.chooseArea'), open: () => setOpen(true), sheet };
}
