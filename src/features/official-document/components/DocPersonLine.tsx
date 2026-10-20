import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { Avatar } from '@/shared/ui/Avatar';
import { Text } from '@/shared/ui/Text';

import type { DocPerson } from '../types';
import { shortUnit } from '../utils/text';

/** 36pt initials avatar, the name, then MSNV · position · unit (what is known), with a "Kiêm nhiệm" tag for a concurrent post. */
export function DocPersonLine({ person, isMe, trailing, testID }: { person: DocPerson; isMe?: boolean; trailing?: ReactNode; testID?: string }) {
  const { t } = useTranslation();
  const rest = [person.position, shortUnit(person.unit)].filter(Boolean).join(' · ');
  return (
    <View testID={testID} className="min-h-[48px] flex-row items-center gap-3">
      <Avatar name={person.name} size={36} />
      <View className="min-w-0 flex-1 gap-0.5">
        <View className="flex-row items-center gap-1.5">
          <Text weight="semibold" numberOfLines={1} className="flex-shrink" style={{ fontSize: 14, lineHeight: 19 }}>
            {isMe ? t('documents.youName', { name: person.name }) : person.name}
          </Text>
          {person.concurrent ? (
            <View className="rounded-full bg-warning-tint px-1.5 py-px">
              <Text weight="semibold" className="text-warning-text" maxFontSizeMultiplier={1.2} style={{ fontSize: 11, lineHeight: 14 }}>
                {t('documents.concurrent')}
              </Text>
            </View>
          ) : null}
        </View>
        {person.code || rest ? (
          <Text numberOfLines={1} className="text-muted" style={{ fontSize: 12, lineHeight: 16 }}>
            {person.code ? (
              <Text mono className="text-muted" style={{ fontSize: 12, lineHeight: 16 }}>
                {person.code}
              </Text>
            ) : null}
            {person.code && rest ? ` · ${rest}` : rest}
          </Text>
        ) : null}
      </View>
      {trailing}
    </View>
  );
}
