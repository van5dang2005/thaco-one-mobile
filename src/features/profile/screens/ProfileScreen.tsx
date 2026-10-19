import { useQueryClient } from '@tanstack/react-query';
import Constants from 'expo-constants';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, AppState, Linking, Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { env } from '@/core/config/env';
import { errorMessage } from '@/core/errors/errorMessage';
import { setLanguage, type Language } from '@/core/i18n';
import { getNotificationPermission, openNotificationSettings, requestNotificationPermission, type NotificationPermission } from '@/core/notifications/permission';
import { registerPushToken } from '@/core/notifications/push';
import { type BiometricKind, biometricKind, disableBiometric, isBiometricEnabled } from '@/core/session/biometric';
import { enableBiometricSignIn, signOut } from '@/core/session/session';
import { useProfile } from '@/core/session/useMe';
import { kv, kvKeys } from '@/core/storage/kv';
import { useTheme } from '@/core/theme/ThemeProvider';
import { LoginHeaderArt } from '@/features/auth/components/LoginHeaderArt';
import { HomeLayoutSheet } from '@/features/home/components/HomeLayoutSheet';
import { useHomePrefs } from '@/features/home/store/homePrefs';
import { cn } from '@/shared/lib/cn';
import { Avatar } from '@/shared/ui/Avatar';
import { BottomSheet } from '@/shared/ui/BottomSheet';
import { Button } from '@/shared/ui/Button';
import { Divider, useCardStyle } from '@/shared/ui/Card';
import { Icon } from '@/shared/ui/Icon';
import {
  BellIcon,
  BuildingIcon,
  ChevronRightIcon,
  CircleQuestionMarkIcon,
  FingerprintPatternIcon,
  GlobeIcon,
  LayoutGridIcon,
  LockIcon,
  LogOutIcon,
  MailIcon,
  PhoneIcon,
  ScanFaceIcon,
  SunMoonIcon,
  type AppIcon,
} from '@/shared/ui/icons';
import { onBlue, useHeaderColors, useLightStatusBar } from '@/shared/ui/ScreenShell';
import { Eyebrow } from '@/shared/ui/SectionTitle';
import { SelectSheet } from '@/shared/ui/SelectSheet';
import { Text } from '@/shared/ui/Text';
import { TextField } from '@/shared/ui/TextField';
import { ThemeModeToggle } from '@/shared/ui/ThemeModeToggle';
import { toast } from '@/shared/ui/Toast';
import { Toggle } from '@/shared/ui/Toggle';

/** Rows start their text after padding 14 + icon box 36 + gap 12. */
const ROW_INSET = 62;
/** Store version, plus the OTA patch when one is published: "1.0.0 (patch 3)". */
const version = [Constants.expoConfig?.version ?? '0.0.0', env.patchVersion && `(patch ${env.patchVersion})`].filter(Boolean).join(' ');
const languageNames: Record<Language, string> = { vi: 'Tiếng Việt', en: 'English' };

/** 36pt icon box, radius 12, #EEF3F9 with a #00539B glyph (7a rows). */
function RowIcon({ icon }: { icon: AppIcon }) {
  const { colors } = useTheme();
  return (
    <View className="h-9 w-9 items-center justify-center rounded-[12px]" style={{ backgroundColor: colors['icon-ring'] }}>
      <Icon icon={icon} size={18} rawColor={colors.primary} />
    </View>
  );
}

/** White card, radius 20, soft shadow; rows 8pt apart vertically, 14 from the sides. */
function ProfileCard({ children, testID }: { children: ReactNode; testID?: string }) {
  const style = useCardStyle();
  return (
    <View testID={testID} className="overflow-hidden rounded-card py-1" style={style}>
      {children}
    </View>
  );
}

/** Read-only row: icon box, 11px muted label over a 13.5/600 value. */
function ContactRow({ icon, label, value, mono, divider }: { icon: AppIcon; label: string; value: string; mono?: boolean; divider?: boolean }) {
  return (
    <>
      {divider ? <Divider inset={ROW_INSET} /> : null}
      <View className="min-h-[48px] flex-row items-center gap-3 px-3.5 py-1.5">
        <RowIcon icon={icon} />
        <View className="min-w-0 flex-1 gap-px">
          <Text numberOfLines={1} className="text-muted" style={{ fontSize: 11, lineHeight: 14 }}>
            {label}
          </Text>
          <Text mono={mono} weight="semibold" numberOfLines={2} selectable style={{ fontSize: 13.5, lineHeight: 18 }}>
            {value}
          </Text>
        </View>
      </View>
    </>
  );
}

type SettingRowProps = {
  icon: AppIcon;
  label: string;
  hint?: string;
  /** Current value before the › ("Tiếng Việt", "Lưới"). */
  value?: string;
  /** Right-hand control instead of value + › (switches). */
  control?: ReactNode;
  onPress?: () => void;
  divider?: boolean;
  testID?: string;
};

/** Settings row: icon box, 13.5/600 label (+ 11px hint), then a value with › or a switch. */
function SettingRow({ icon, label, hint, value, control, onPress, divider, testID }: SettingRowProps) {
  const content = (
    <>
      <RowIcon icon={icon} />
      <View className="min-w-0 flex-1 gap-px">
        <Text weight="semibold" numberOfLines={1} style={{ fontSize: 13.5, lineHeight: 18 }}>
          {label}
        </Text>
        {hint ? (
          <Text numberOfLines={2} className="text-muted" style={{ fontSize: 11, lineHeight: 14 }}>
            {hint}
          </Text>
        ) : null}
      </View>
      {control ?? (
        <View className="flex-row items-center gap-1">
          {value ? (
            <Text numberOfLines={1} className="text-muted" style={{ fontSize: 13, lineHeight: 17 }}>
              {value}
            </Text>
          ) : null}
          <Icon icon={ChevronRightIcon} size={16} color="subtle" />
        </View>
      )}
    </>
  );
  const row = 'min-h-[52px] flex-row items-center gap-3 px-3.5 py-2';
  return (
    <>
      {divider ? <Divider inset={ROW_INSET} /> : null}
      {onPress ? (
        <Pressable testID={testID} accessibilityRole="button" onPress={onPress} className={cn(row, 'active:bg-line-2')}>
          {content}
        </Pressable>
      ) : (
        <View testID={testID} className={row}>
          {content}
        </View>
      )}
    </>
  );
}

/** 24pt pill on the blue header: white 12% fill, white 16% border (MSNV in mono, "Ban · Công ty"). */
function HeaderTag({ label, mono }: { label: string; mono?: boolean }) {
  const { fg } = useHeaderColors();
  return (
    <View className="h-6 flex-shrink justify-center rounded-full px-2.5" style={{ backgroundColor: onBlue(0.12), borderWidth: 1, borderColor: onBlue(0.16) }}>
      <Text mono={mono} weight="semibold" numberOfLines={1} maxFontSizeMultiplier={1.2} style={{ fontSize: 11.5, lineHeight: 15, color: fg }}>
        {label}
      </Text>
    </View>
  );
}

/** Notification popups are on when the user wants them and, where readable, the OS allows them. */
function useNotificationSetting() {
  const [wanted, setWanted] = useState(() => kv.getBoolean(kvKeys.notificationPopups) !== false);
  const [permission, setPermission] = useState<NotificationPermission | null>(null);

  const refresh = useCallback(() => void getNotificationPermission().then(setPermission), []);
  useEffect(() => {
    refresh();
    // Coming back from the system Settings may have changed the permission.
    const sub = AppState.addEventListener('change', (state) => state === 'active' && refresh());
    return () => sub.remove();
  }, [refresh]);

  const save = (value: boolean) => {
    kv.set(kvKeys.notificationPopups, value);
    setWanted(value);
  };

  return {
    value: wanted && (!permission?.available || permission.granted),
    save,
    setPermission,
    permission,
  };
}

/** "Cá nhân" tab (7a): identity on the blue header, read-only contact card over it, settings, sign-out. */
export function ProfileScreen() {
  const { t, i18n } = useTranslation();
  const { colors, preference, setPreference } = useTheme();
  const { bg, fg, text2 } = useHeaderColors();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const profile = useProfile();
  const notifications = useNotificationSetting();
  const [biometricOn, setBiometricOn] = useState(() => isBiometricEnabled());
  const [biometric, setBiometric] = useState<BiometricKind>('none');
  const [refreshing, setRefreshing] = useState(false);
  const [sheet, setSheet] = useState<'language' | 'layout' | 'biometric' | null>(null);
  const homeLayout = useHomePrefs((s) => s.layout);
  const language = (i18n.language === 'en' ? 'en' : 'vi') as Language;
  useLightStatusBar();

  useEffect(() => {
    void biometricKind().then(setBiometric);
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await queryClient.invalidateQueries({ queryKey: ['me'] });
    setRefreshing(false);
  };

  const confirmSignOut = () =>
    Alert.alert(t('profile.signOut'), t('profile.signOutConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('profile.signOut'), style: 'destructive', onPress: () => void signOut() },
    ]);

  const contactIt = () => (env.itSupportPhone ? void Linking.openURL(`tel:${env.itSupportPhone}`) : Alert.alert(t('auth.contactIt'), t('auth.contactItMessage')));

  const toggleBiometric = (value: boolean) => {
    if (value) return setSheet('biometric');
    void disableBiometric();
    setBiometricOn(false);
  };

  const toggleNotifications = async (value: boolean) => {
    notifications.save(value);
    if (!value) return;
    let permission = await getNotificationPermission();
    if (permission.available && !permission.granted && permission.canAskAgain) permission = await requestNotificationPermission();
    notifications.setPermission(permission);
    if (permission.granted) void registerPushToken();
    if (permission.available && !permission.granted) {
      Alert.alert(t('profile.notificationsDeniedTitle'), t('profile.notificationsDenied'), [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('profile.openSettings'), onPress: () => void openNotificationSettings() },
      ]);
    }
  };

  const org = [profile.departmentName, profile.unitName].filter(Boolean).join(' · ');
  const faceLabel = biometric === 'face' ? t('profile.biometricFace') : t('profile.biometricFinger');

  return (
    <View className="flex-1 bg-canvas">
      <ScrollView
        testID="profile-scroll"
        // The blue header lives inside the scroll view: keep iOS from shifting it by the safe area.
        contentInsetAdjustmentBehavior="never"
        automaticallyAdjustContentInsets={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#FFFFFF" />}
        contentContainerStyle={{ paddingBottom: 24 }}
      >
        {/* Blue above the header so pull-to-refresh never shows the grey canvas. */}
        <View pointerEvents="none" style={{ position: 'absolute', top: -1000, left: 0, right: 0, height: 1000, backgroundColor: bg }} />

        <View testID="profile-header" className="gap-[18px] overflow-hidden" style={{ backgroundColor: bg, paddingTop: insets.top + 6, paddingHorizontal: 20, paddingBottom: 38 }}>
          <LoginHeaderArt ringCount={4} />
          <View className="flex-row items-center gap-3.5">
            <View className="rounded-full p-1" style={{ backgroundColor: onBlue(0.18) }}>
              <Avatar name={profile.fullname} uri={profile.avatarUrl} size={68} light />
            </View>
            <View className="min-w-0 flex-1 gap-1">
              <Text weight="bold" numberOfLines={1} accessibilityRole="header" style={{ fontSize: 20, lineHeight: 26, letterSpacing: -0.3, color: fg }}>
                {profile.fullname ?? '—'}
              </Text>
              {profile.jobTitleName ? (
                <Text numberOfLines={1} style={{ fontSize: 12.5, lineHeight: 17, color: text2 }}>
                  {profile.jobTitleName}
                </Text>
              ) : null}
              <View className="flex-row flex-wrap gap-1.5 pt-1">
                {profile.employeeCode ? <HeaderTag mono label={profile.employeeCode} /> : null}
                {org ? <HeaderTag label={org} /> : null}
              </View>
            </View>
          </View>
        </View>

        <View className="gap-3 px-4" style={{ marginTop: -26 }}>
          <ProfileCard testID="profile-contact">
            <ContactRow icon={MailIcon} label={t('profile.email')} value={profile.email ?? '—'} />
            <ContactRow divider icon={PhoneIcon} label={t('profile.phone')} value={profile.phoneNumber || '—'} mono />
            {profile.workplace ? <ContactRow divider icon={BuildingIcon} label={t('profile.workplace')} value={profile.workplace} /> : null}
          </ProfileCard>

          <View className="px-1">
            <Eyebrow>{t('profile.settings')}</Eyebrow>
          </View>
          <ProfileCard>
            <View testID="profile-appearance" className="gap-2 px-3.5 pb-2.5 pt-2">
              <View className="flex-row items-center gap-3">
                <RowIcon icon={SunMoonIcon} />
                <View className="min-w-0 flex-1 gap-px">
                  <Text weight="semibold" numberOfLines={1} style={{ fontSize: 13.5, lineHeight: 18 }}>
                    {t('appearance.title')}
                  </Text>
                  <Text numberOfLines={2} className="text-muted" style={{ fontSize: 11, lineHeight: 14 }}>
                    {t('appearance.hint')}
                  </Text>
                </View>
              </View>
              <ThemeModeToggle testID="profile-theme" value={preference} onChange={setPreference} />
            </View>
            <SettingRow divider testID="profile-language" icon={GlobeIcon} label={t('profile.language')} value={languageNames[language]} onPress={() => setSheet('language')} />
            {biometric !== 'none' ? (
              <SettingRow
                divider
                icon={biometric === 'face' ? ScanFaceIcon : FingerprintPatternIcon}
                label={faceLabel}
                hint={t('profile.biometricHint')}
                control={<Toggle testID="profile-biometric" value={biometricOn} onChange={toggleBiometric} accessibilityLabel={faceLabel} />}
              />
            ) : null}
            <SettingRow
              divider
              icon={BellIcon}
              label={t('profile.notifications')}
              hint={t('profile.notificationsHint')}
              control={<Toggle testID="profile-notifications" value={notifications.value} onChange={(v) => void toggleNotifications(v)} accessibilityLabel={t('profile.notifications')} />}
            />
            <SettingRow divider testID="profile-home-layout" icon={LayoutGridIcon} label={t('home.layoutSheet.title')} value={t(`home.layouts.${homeLayout}.name`)} onPress={() => setSheet('layout')} />
            <SettingRow divider testID="profile-it" icon={CircleQuestionMarkIcon} label={t('auth.itSupport')} onPress={contactIt} />
          </ProfileCard>

          <Pressable
            testID="profile-signout"
            accessibilityRole="button"
            onPress={confirmSignOut}
            className="h-[48px] flex-row items-center justify-center gap-2 rounded-[14px] bg-elevated active:opacity-70"
            style={{ borderWidth: 1.5, borderColor: colors['danger-border'] }}
          >
            <Icon icon={LogOutIcon} size={18} weight="bold" rawColor={colors['danger-text']} />
            <Text weight="bold" style={{ fontSize: 14.5, lineHeight: 19, color: colors['danger-text'] }}>
              {t('profile.signOut')}
            </Text>
          </Pressable>
          <Text mono className="text-center text-subtle" style={{ fontSize: 11, lineHeight: 15 }}>
            {t('profile.version', { version })}
          </Text>
        </View>
      </ScrollView>

      <SelectSheet<Language>
        testID="profile-language-sheet"
        visible={sheet === 'language'}
        onClose={() => setSheet(null)}
        title={t('profile.language')}
        value={language}
        options={(['vi', 'en'] as const).map((value) => ({ value, label: languageNames[value] }))}
        onSelect={(value) => void setLanguage(value)}
      />
      <HomeLayoutSheet visible={sheet === 'layout'} onClose={() => setSheet(null)} />
      <BiometricSheet
        visible={sheet === 'biometric'}
        onClose={() => setSheet(null)}
        title={faceLabel}
        onEnabled={() => {
          setBiometricOn(true);
          setSheet(null);
        }}
      />
    </View>
  );
}

/** The signed-in account as typed on the login form (Face ID / fingerprint is set up per account). */
const signedInAccount = () => ({ username: kv.getString(kvKeys.lastUsername) ?? '', domain: kv.getString(kvKeys.lastDomain) ?? '' });

/**
 * Turning biometric sign-in on from Profile: Face ID / fingerprint opens an offline token that only the
 * password can obtain, and the app does not keep the password, so ask for it once (Keycloak checks it),
 * then store the token behind biometrics (SecureStore) like the login screen does.
 */
function BiometricSheet({ visible, onClose, onEnabled, title }: { visible: boolean; onClose: () => void; onEnabled: () => void; title: string }) {
  const { t } = useTranslation();
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { username, domain } = signedInAccount();

  const close = () => {
    setPassword('');
    setError(null);
    onClose();
  };

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const credentials = { username, password, domain };
      const outcome = await enableBiometricSignIn(credentials, t('auth.biometricPrompt'), t('common.cancel'));
      if (outcome === 'failed') setError(t('auth.biometricFailed'));
      if (outcome !== 'enabled') return;
      toast.success(t('profile.biometricEnabled'));
      setPassword('');
      onEnabled();
    } catch (e) {
      setError(errorMessage(e, t));
    } finally {
      setBusy(false);
    }
  };

  return (
    <BottomSheet
      visible={visible}
      onClose={close}
      icon={ScanFaceIcon}
      title={title}
      caption={domain && username ? `${domain}\\${username}` : undefined}
      footer={<Button testID="profile-biometric-submit" label={t('profile.biometricEnable')} loading={busy} disabled={!password} onPress={() => void submit()} />}
    >
      <Text className="text-sub text-muted">{t('profile.biometricPasswordHint')}</Text>
      <TextField
        testID="profile-biometric-password"
        filled
        leftIcon={LockIcon}
        label={t('auth.password')}
        placeholder={t('auth.passwordPlaceholder')}
        secureTextEntry
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="current-password"
        textContentType="password"
        returnKeyType="go"
        value={password}
        onChangeText={setPassword}
        onSubmitEditing={() => password && void submit()}
        error={error ?? undefined}
      />
    </BottomSheet>
  );
}
