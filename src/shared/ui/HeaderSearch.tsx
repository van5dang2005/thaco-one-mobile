import { useTranslation } from 'react-i18next';
import { Pressable, TextInput, View } from 'react-native';

import { MAX_FONT_SCALE, useFontStyle } from '@/core/theme/fonts';

import { Icon } from './Icon';
import { SearchIcon, XIcon } from './icons';
import { onBlue, useHeaderColors } from './ScreenShell';

type Props = { value: string; onChange: (value: string) => void; onClose: () => void; placeholder: string; testID?: string };

/** Search field that opens inside a blue header (toolbar search button). */
export function HeaderSearch({ value, onChange, onClose, placeholder, testID }: Props) {
  const { t } = useTranslation();
  const { fg, text2 } = useHeaderColors();
  const font = useFontStyle('regular');
  return (
    <View className="mb-3 h-10 flex-row items-center gap-2 rounded-[12px] px-3" style={{ backgroundColor: onBlue(0.14) }}>
      <Icon icon={SearchIcon} size={16} rawColor={text2} />
      <TextInput
        testID={testID}
        autoFocus
        maxFontSizeMultiplier={MAX_FONT_SCALE}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={text2}
        returnKeyType="search"
        className="flex-1"
        style={{ color: fg, fontSize: 14, ...font, paddingVertical: 0 }}
      />
      <Pressable accessibilityRole="button" accessibilityLabel={t('common.close')} onPress={onClose} hitSlop={10}>
        <Icon icon={XIcon} size={16} rawColor={text2} />
      </Pressable>
    </View>
  );
}
