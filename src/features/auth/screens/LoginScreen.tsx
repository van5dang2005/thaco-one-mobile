import { zodResolver } from '@hookform/resolvers/zod';
import { Image } from 'expo-image';
import { useFocusEffect } from 'expo-router';
import { setStatusBarStyle } from 'expo-status-bar';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Alert, AppState, KeyboardAvoidingView, Linking, type NativeEventSubscription, Platform, Pressable, TextInput, View } from 'react-native';
import Animated, { Extrapolation, interpolate, useAnimatedScrollHandler, useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { env, loginDomains } from '@/core/config/env';
import { errorMessage } from '@/core/errors/errorMessage';
import { currentLanguage, setLanguage } from '@/core/i18n';
import { biometricKind, type BiometricKind, type BiometricSession, isBiometricEnabled, unlockBiometric } from '@/core/session/biometric';
import { enableBiometricSignIn, signIn, signInWithBiometric } from '@/core/session/session';
import { useSessionStore } from '@/core/session/sessionStore';
import { kv, kvKeys } from '@/core/storage/kv';
import { useTheme } from '@/core/theme/ThemeProvider';
import { images, WORDMARK_RATIO } from '@/shared/assets';
import { Banner } from '@/shared/ui/Banner';
import { Button } from '@/shared/ui/Button';
import { Icon } from '@/shared/ui/Icon';
import {
  ArrowRightIcon,
  CheckIcon,
  ChevronDownIcon,
  CircleQuestionMarkIcon,
  EyeIcon,
  EyeOffIcon,
  FingerprintPatternIcon,
  GlobeIcon,
  LockIcon,
  ScanFaceIcon,
  ServerIcon,
  ShieldCheckIcon,
  UserIcon,
} from '@/shared/ui/icons';
import { onBlue, useHeaderColors } from '@/shared/ui/ScreenShell';
import { SelectSheet } from '@/shared/ui/SelectSheet';
import { shadows } from '@/shared/ui/shadows';
import { Text } from '@/shared/ui/Text';
import { TextField } from '@/shared/ui/TextField';
import { toast } from '@/shared/ui/Toast';

import { LoginHeaderArt } from '../components/LoginHeaderArt';
import { loginSchema, type LoginForm } from '../schemas/login.schema';

/** "Ghi nhớ đăng nhập" is on unless the user turned it off. */
const rememberedByDefault = () => kv.getBoolean(kvKeys.rememberLogin) !== false;

/** Last used login domain while it is still offered. */
const lastDomain = () => {
  const last = kv.getString(kvKeys.lastDomain);
  return loginDomains.find((value) => value === last) ?? loginDomains[0];
};

/** Member companies of the THACO group on the header: proper names, the same in every language. */
const groupCompanies = ['THILOGI', 'THACO INDUSTRIES', 'THACO AUTO', 'THACO AGRI', 'THISO', 'ĐẠI QUANG MINH'] as const;

/** Gap between the status bar and the header's first row (wordmark, language). */
const HEADER_TOP_GAP = 14;

/** Đăng nhập (6a): blue header with the portal title, a white form card over it, a security note and the footer. */
export function LoginScreen() {
  const { t } = useTranslation();
  const { colors, scheme } = useTheme();
  const { bg, fg, text3 } = useHeaderColors();
  const insets = useSafeAreaInsets();
  const passwordRef = useRef<TextInput>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [domainOpen, setDomainOpen] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [biometric, setBiometric] = useState<BiometricKind>('none');
  const [biometricOn, setBiometricOn] = useState(() => isBiometricEnabled());
  const unlocking = useRef(false);
  const [busy, setBusy] = useState(false);
  const [remember, setRemember] = useState(rememberedByDefault);
  const sessionExpired = useSessionStore((s) => s.signOutReason === 'expired');

  const { control, handleSubmit, setValue, formState } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      domain: lastDomain(),
      username: rememberedByDefault() ? (kv.getString(kvKeys.rememberedUsername) ?? kv.getString(kvKeys.lastUsername) ?? '') : '',
      password: '',
    },
  });
  const domain = useWatch({ control, name: 'domain' });
  // The whole page scrolls (large fonts, open keyboard): a header-blue band fades in under the status bar and is
  // opaque by the time the first row reaches it, so no text runs under the clock and battery.
  const scrollY = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((event) => {
    scrollY.value = event.contentOffset.y;
  });
  const statusBarBand = useAnimatedStyle(() => ({ opacity: interpolate(scrollY.value, [0, HEADER_TOP_GAP], [0, 1], Extrapolation.CLAMP) }));

  useEffect(() => {
    let cancelled = false;
    let subscription: NativeEventSubscription | undefined;
    void biometricKind().then((kind) => {
      if (cancelled) return;
      setBiometric(kind);
      // Ask for Face ID / fingerprint right away at launch or after an expired session, not after signing out by hand.
      if (kind === 'none' || !isBiometricEnabled() || useSessionStore.getState().signOutReason === 'user') return;
      if (AppState.currentState !== 'background') {
        void onBiometric();
        return;
      }
      // The session expired while the app was in the background, where no prompt can show: wait until it is back.
      subscription = AppState.addEventListener('change', (state) => {
        if (state !== 'active') return;
        subscription?.remove();
        void onBiometric();
      });
    });
    return () => {
      cancelled = true;
      subscription?.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only on mount
  }, []);

  useFocusEffect(
    useCallback(() => {
      setStatusBarStyle('light');
      return () => setStatusBarStyle(scheme === 'dark' ? 'light' : 'dark');
    }, [scheme]),
  );

  /**
   * After a password sign-in: offer biometric sign-in for this account. Signing in already turned off another
   * account's, so any still set up is this account's own.
   */
  const offerBiometric = (values: LoginForm) => {
    if (biometric === 'none' || isBiometricEnabled()) return;
    const enable = async () => {
      try {
        const outcome = await enableBiometricSignIn(values, t('auth.biometricPrompt'), t('common.cancel'));
        if (outcome === 'enabled') toast.success(t('profile.biometricEnabled'));
        else if (outcome === 'failed') toast.error(t('auth.biometricFailed'));
      } catch (error) {
        toast.error(errorMessage(error, t));
      }
    };
    Alert.alert(t('auth.enableBiometricTitle'), t('auth.enableBiometricMessage'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('auth.enableBiometricAccept'), onPress: () => void enable() },
    ]);
  };

  const rememberUsername = (username: string) => {
    kv.set(kvKeys.rememberLogin, remember);
    if (remember) kv.set(kvKeys.rememberedUsername, username.trim());
    else kv.remove(kvKeys.rememberedUsername);
  };

  const onSubmit = async (values: LoginForm) => {
    setSubmitError(null);
    setBusy(true);
    try {
      await signIn(values);
      rememberUsername(values.username);
      offerBiometric(values);
    } catch (error) {
      setSubmitError(errorMessage(error, t));
    } finally {
      setBusy(false);
    }
  };

  const finishBiometric = async (session: BiometricSession) => {
    setBusy(true);
    try {
      if ((await signInWithBiometric(session)) === 'signedIn') {
        rememberUsername(session.account.username);
      } else {
        setBiometricOn(false);
        setSubmitError(t('auth.biometricExpired'));
      }
    } catch (error) {
      setSubmitError(errorMessage(error, t));
    } finally {
      setBusy(false);
    }
  };

  const onBiometric = async () => {
    // One prompt at a time: Android rejects a second one while the first is open.
    if (busy || unlocking.current || !isBiometricEnabled()) return;
    unlocking.current = true;
    setSubmitError(null);
    try {
      const unlock = await unlockBiometric(t('auth.biometricPrompt'));
      if (unlock.status === 'ok') {
        await finishBiometric(unlock);
      } else if (unlock.status === 'invalidated') {
        setBiometricOn(false);
        setSubmitError(t('auth.biometricInvalidated'));
      } else if (unlock.status === 'failed') {
        setSubmitError(t('auth.biometricFailed'));
      }
    } finally {
      unlocking.current = false;
    }
  };

  const contactIt = () => (env.itSupportEmail ? void Linking.openURL(`mailto:${env.itSupportEmail}`).catch(() => Alert.alert(t('auth.contactIt'), env.itSupportEmail)) : Alert.alert(t('auth.contactIt'), t('auth.contactItMessage')));
  const fieldError = (key?: string) => (key ? t(key as 'validation.required', { max: 100 }) : undefined);
  const submit = handleSubmit(onSubmit);

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1" style={{ backgroundColor: colors.canvas }}>
      <Animated.ScrollView
        keyboardShouldPersistTaps="handled"
        onScroll={onScroll}
        scrollEventThrottle={16}
        contentContainerStyle={{ flexGrow: 1, paddingBottom: Math.max(insets.bottom, 16) }}
        bounces={false}
      >
        {/* Header */}
        <View className="overflow-hidden" style={{ backgroundColor: bg, paddingTop: insets.top + HEADER_TOP_GAP, paddingHorizontal: 22, paddingBottom: 96 }}>
          <LoginHeaderArt />
          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center gap-3" accessibilityRole="header" accessibilityLabel="THACO ONE">
              <Image source={images.wordmark} style={{ height: 20, width: 20 * WORDMARK_RATIO }} contentFit="contain" accessibilityIgnoresInvertColors />
              <View className="h-4 w-px" style={{ backgroundColor: onBlue(0.35) }} />
              <Text weight="bold" style={{ fontSize: 12, lineHeight: 15, letterSpacing: 1.7, color: '#CFE0F1' }}>
                ONE
              </Text>
            </View>
            <Pressable
              testID="login-language"
              accessibilityRole="button"
              accessibilityLabel={t('auth.language')}
              onPress={() => setLanguage(currentLanguage() === 'vi' ? 'en' : 'vi')}
              hitSlop={6}
              className="h-[34px] flex-row items-center gap-1.5 rounded-full px-3 active:opacity-70"
              style={{ backgroundColor: onBlue(0.14), borderWidth: 1, borderColor: onBlue(0.18) }}
            >
              <Icon icon={GlobeIcon} size={15} rawColor={fg} />
              <Text weight="bold" style={{ fontSize: 12.5, lineHeight: 16, color: fg }}>
                {t('auth.languageShort')}
              </Text>
              <Icon icon={ChevronDownIcon} size={13} weight="bold" rawColor={fg} />
            </Pressable>
          </View>

          <Text weight="semibold" className="mt-10" style={{ fontSize: 13, lineHeight: 17, color: text3 }}>
            {t('auth.portal')}
          </Text>
          <Text weight="bold" accessibilityRole="header" maxFontSizeMultiplier={1.1} className="mt-2" style={{ fontSize: 34, lineHeight: 41, letterSpacing: -0.8, color: fg }}>
            {t('auth.headline')}
          </Text>
          <View className="mt-4 flex-row flex-wrap gap-2">
            {groupCompanies.map((name) => (
              <CompanyChip key={name} name={name} />
            ))}
          </View>
        </View>

        {/* Form card */}
        <View className="mx-4 gap-3.5 rounded-[24px] bg-elevated p-[18px]" style={[shadows.card, { marginTop: -62 }]}>
          {sessionExpired ? (
            <Banner tone="warning" testID="login-session-expired">
              {t('auth.sessionExpired')}
            </Banner>
          ) : null}
          <Pressable
            testID="login-domain"
            accessibilityRole="button"
            accessibilityLabel={`${t('auth.domain')}: ${domain || t('auth.domainNone')}. ${t('auth.change')}`}
            onPress={() => setDomainOpen(true)}
            className="min-h-[56px] flex-row items-center gap-3 rounded-[14px] bg-panel px-3 active:opacity-80"
          >
            <View className="h-8 w-8 items-center justify-center rounded-[9px] bg-elevated">
              <Icon icon={ServerIcon} size={16} color="ink-2" />
            </View>
            <View className="min-w-0 flex-1">
              <Text className="text-muted" style={{ fontSize: 11, lineHeight: 14 }}>
                {t('auth.domain')}
              </Text>
              <Text mono={!!domain} weight="medium" numberOfLines={1} className="text-ink" style={{ fontSize: 14, lineHeight: 19 }}>
                {domain || t('auth.domainNone')}
              </Text>
            </View>
            <View className="flex-row items-center gap-1">
              <Text weight="semibold" className="text-primary" style={{ fontSize: 13, lineHeight: 17 }}>
                {t('auth.change')}
              </Text>
              <Icon icon={ChevronDownIcon} size={14} weight="bold" color="primary" />
            </View>
          </Pressable>

          <Controller
            control={control}
            name="username"
            render={({ field }) => (
              <TextField
                testID="login-username"
                filled
                leftIcon={UserIcon}
                label={t('auth.username')}
                placeholder={domain ? t('auth.usernamePlaceholder') : t('auth.employeeCodePlaceholder')}
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="username"
                textContentType="username"
                returnKeyType="next"
                value={field.value}
                onChangeText={field.onChange}
                onBlur={field.onBlur}
                onSubmitEditing={() => passwordRef.current?.focus()}
                error={fieldError(formState.errors.username?.message)}
              />
            )}
          />
          <Controller
            control={control}
            name="password"
            render={({ field }) => (
              <TextField
                ref={passwordRef}
                testID="login-password"
                filled
                leftIcon={LockIcon}
                label={t('auth.password')}
                placeholder={t('auth.passwordPlaceholder')}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="current-password"
                textContentType="password"
                returnKeyType="go"
                value={field.value}
                onChangeText={field.onChange}
                onBlur={field.onBlur}
                onSubmitEditing={submit}
                error={fieldError(formState.errors.password?.message)}
                right={
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={showPassword ? t('auth.hidePassword') : t('auth.showPassword')}
                    onPress={() => setShowPassword((v) => !v)}
                    hitSlop={10}
                  >
                    <Icon icon={showPassword ? EyeOffIcon : EyeIcon} size={20} color="subtle" />
                  </Pressable>
                }
              />
            )}
          />

          {/* Wraps: with a large system font "Quên mật khẩu?" moves to a line of its own (still on the right) instead of off the card. */}
          <View className="flex-row flex-wrap items-center gap-x-3">
            <Pressable
              testID="login-remember"
              accessibilityRole="checkbox"
              accessibilityState={{ checked: remember }}
              onPress={() => setRemember((v) => !v)}
              hitSlop={8}
              className="min-h-[36px] flex-shrink flex-row items-center gap-2 active:opacity-70"
            >
              <View
                className="h-5 w-5 items-center justify-center rounded-[6px]"
                style={remember ? { backgroundColor: colors.primary } : { borderWidth: 1.5, borderColor: colors['line-strong'], backgroundColor: colors.elevated }}
              >
                {remember ? <Icon icon={CheckIcon} size={13} weight="bold" color="on-primary" /> : null}
              </View>
              <Text className="flex-shrink text-ink-2" style={{ fontSize: 13, lineHeight: 17 }}>
                {t('auth.remember')}
              </Text>
            </Pressable>
            <Pressable accessibilityRole="link" hitSlop={8} onPress={() => Alert.alert(t('auth.forgotTitle'), t('auth.forgotMessage'))} className="ml-auto min-h-[36px] justify-center active:opacity-60">
              <Text weight="semibold" className="text-primary" style={{ fontSize: 13, lineHeight: 17 }}>
                {t('auth.forgot')}
              </Text>
            </Pressable>
          </View>

          {submitError ? (
            <Banner tone="danger" testID="login-error">
              {submitError}
            </Banner>
          ) : null}

          <View className="flex-row gap-2.5">
            <Button
              testID="login-submit"
              className="h-[54px] flex-1"
              label={busy ? t('auth.signingIn') : t('auth.submit')}
              loading={busy}
              onPress={submit}
              trailing={busy ? undefined : <Icon icon={ArrowRightIcon} size={18} weight="bold" color="on-primary" />}
            />
            {biometric !== 'none' && biometricOn ? (
              <Pressable
                testID="login-biometric"
                accessibilityRole="button"
                accessibilityLabel={biometric === 'face' ? t('auth.biometricFace') : t('auth.biometricFinger')}
                disabled={busy}
                onPress={() => void onBiometric()}
                className="h-[54px] w-[54px] items-center justify-center rounded-[14px] bg-elevated active:opacity-70"
                style={{ borderWidth: 1.5, borderColor: colors['input-border'] }}
              >
                <Icon icon={biometric === 'face' ? ScanFaceIcon : FingerprintPatternIcon} size={24} color="primary" />
              </Pressable>
            ) : null}
          </View>
        </View>

        {/* Security note */}
       {/*  <View className="mx-4 mt-3 flex-row items-start gap-3 rounded-[16px] bg-elevated p-3">
          <View className="h-8 w-8 items-center justify-center rounded-[9px] bg-success-tint">
            <Icon icon={ShieldCheckIcon} size={16} color="success" />
          </View>
          <Text className="flex-1 text-ink-2" style={{ fontSize: 12.5, lineHeight: 18 }}>
            {t('auth.securityNote')}
          </Text>
        </View> */}

        {/* Footer */}
        <View className="mt-auto flex-row flex-wrap items-center justify-between gap-x-3 gap-y-2 px-5 pt-8">
          <Text mono className="text-subtle" style={{ fontSize: 11, lineHeight: 15 }}>
            {t('auth.footer', { version: env.appVersion, year: new Date().getFullYear() })}
          </Text>
          <Pressable testID="login-it-support" accessibilityRole="link" onPress={contactIt} hitSlop={8} className="flex-row items-center gap-1 active:opacity-60">
            <Icon icon={CircleQuestionMarkIcon} size={15} color="primary" />
            <Text weight="semibold" className="text-primary" style={{ fontSize: 12.5, lineHeight: 16 }}>
              {t('auth.itSupport')}
            </Text>
          </Pressable>
        </View>
      </Animated.ScrollView>
      <Animated.View pointerEvents="none" style={[{ position: 'absolute', top: 0, left: 0, right: 0, height: insets.top, backgroundColor: bg }, statusBarBand]} />

      <SelectSheet
        testID="login-domain-sheet"
        visible={domainOpen}
        onClose={() => setDomainOpen(false)}
        title={t('auth.chooseDomain')}
        mono
        value={domain}
        options={loginDomains.map((value) => ({ value, label: value ? `@${value}` : t('auth.domainNone') }))}
        onSelect={(value) => setValue('domain', value)}
      />
    </KeyboardAvoidingView>
  );
}

/** Company name on the header: plain uppercase on a faint white pill. */
function CompanyChip({ name }: { name: string }) {
  return (
    <View className="h-[26px] justify-center rounded-full px-3" style={{ backgroundColor: onBlue(0.1), borderWidth: 1, borderColor: onBlue(0.14) }}>
      <Text weight="bold" numberOfLines={1} maxFontSizeMultiplier={1.2} style={{ fontSize: 11, lineHeight: 14, letterSpacing: 0.6, color: onBlue(0.92) }}>
        {name}
      </Text>
    </View>
  );
}
