import * as Haptics from 'expo-haptics';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Linking, Pressable, StyleSheet, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { goBack } from '@/shared/lib/navigation';
import { Button } from '@/shared/ui/Button';
import { Icon } from '@/shared/ui/Icon';
import { type AppIcon, CameraIcon, ChevronLeftIcon, FlashlightIcon, FlashlightOffIcon, ScanQrCodeIcon } from '@/shared/ui/icons';
import { useLightStatusBar } from '@/shared/ui/ScreenShell';
import { Text } from '@/shared/ui/Text';

import { camera, type CameraModule } from '../utils/camera';

const FRAME = 250;
const CORNER = 36;
const CORNER_WIDTH = 4;
/** Light blue that reads on any camera picture (the brand blue is too dark there). */
const SCAN_ACCENT = '#5AA9FF';
/** Frosted dark disc behind the floating buttons and the hint: readable over any camera picture. */
const SCRIM = 'rgba(0, 0, 0, 0.42)';

/**
 * "Quét mã QR" (guest check-in, step 1): the back camera full screen with a frame and a sweeping line; the toolbar
 * (back, title, torch) and the hint float over it. A QR opens "Xác nhận vào cổng"; coming back here scans again.
 */
export function GuestScanScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [torch, setTorch] = useState(false);
  const cam = camera();
  useLightStatusBar();

  return (
    <View testID="guest-scan-screen" className="flex-1" style={{ backgroundColor: '#000000' }}>
      <View style={StyleSheet.absoluteFill}>{cam ? <Scanner cam={cam} torch={torch} /> : <Blocked message={t('guestSchedule.scan.unsupported')} />}</View>

      <View testID="guest-scan-header" className="absolute left-0 right-0 top-0 min-h-10 flex-row items-center gap-3 px-4" style={{ paddingTop: insets.top + 10 }}>
        <CamButton testID="guest-scan-back" icon={ChevronLeftIcon} label={t('common.back')} onPress={() => goBack('/guests')} />
        <Text weight="bold" accessibilityRole="header" numberOfLines={1} className="flex-1 text-center" style={{ color: '#FFFFFF', fontSize: 17, lineHeight: 22 }}>
          {t('guestSchedule.scan.title')}
        </Text>
        {cam ? (
          <CamButton
            testID="guest-scan-torch"
            icon={torch ? FlashlightOffIcon : FlashlightIcon}
            label={t(torch ? 'guestSchedule.scan.torchOff' : 'guestSchedule.scan.torchOn')}
            active={torch}
            onPress={() => setTorch((on) => !on)}
          />
        ) : (
          <View className="w-10" />
        )}
      </View>

      <View pointerEvents="none" className="absolute left-0 right-0 items-center px-8" style={{ bottom: Math.max(insets.bottom, 16) + 16 }}>
        <View className="flex-row items-center gap-2.5 rounded-full py-2.5 pl-3.5 pr-4" style={{ backgroundColor: SCRIM }}>
          <Icon icon={ScanQrCodeIcon} size={20} rawColor="#FFFFFF" />
          <Text weight="medium" className="flex-shrink" style={{ color: '#FFFFFF', fontSize: 14, lineHeight: 20 }}>
            {t('guestSchedule.scan.hint')}
          </Text>
        </View>
      </View>
    </View>
  );
}

/** 40pt round button floating on the camera; `active` (torch on) turns it white. */
function CamButton({ icon, label, onPress, active, testID }: { icon: AppIcon; label: string; onPress: () => void; active?: boolean; testID?: string }) {
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={active === undefined ? undefined : { selected: active }}
      hitSlop={6}
      onPress={onPress}
      className="h-10 w-10 items-center justify-center rounded-full active:opacity-70"
      style={{ backgroundColor: active ? '#FFFFFF' : SCRIM }}
    >
      <Icon icon={icon} size={20} weight="bold" rawColor={active ? '#000000' : '#FFFFFF'} />
    </Pressable>
  );
}

/** Camera with the permission prompt. Runs only while the screen is focused, so a code is read once per visit. */
function Scanner({ cam, torch }: { cam: CameraModule; torch: boolean }) {
  const { t } = useTranslation();
  const [permission, requestPermission] = cam.useCameraPermissions();
  const [focused, setFocused] = useState(false);
  // The camera reports the same code many times a second, before navigation blurs the screen.
  const locked = useRef(false);

  useFocusEffect(
    useCallback(() => {
      locked.current = false;
      setFocused(true);
      return () => setFocused(false);
    }, []),
  );

  if (!permission) return null;
  if (!permission.granted) {
    return permission.canAskAgain ? (
      <Blocked message={t('guestSchedule.scan.permission')} action={t('guestSchedule.scan.allowCamera')} onAction={() => void requestPermission()} />
    ) : (
      <Blocked message={t('guestSchedule.scan.permissionDenied')} action={t('profile.openSettings')} onAction={() => void Linking.openSettings()} />
    );
  }

  const onScanned = ({ data }: { data: string }) => {
    if (locked.current || !data.trim()) return;
    locked.current = true;
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    router.push({ pathname: '/guests/check-in', params: { qr: data } });
  };

  return (
    <>
      {focused ? (
        <cam.CameraView
          style={StyleSheet.absoluteFill}
          facing="back"
          enableTorch={torch}
          barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
          onBarcodeScanned={onScanned}
        />
      ) : null}
      <Viewfinder />
    </>
  );
}

/** Frame with four corner marks over a dimmed picture and a line sweeping top to bottom. */
function Viewfinder() {
  const sweep = useSharedValue(0);

  useEffect(() => {
    sweep.set(withRepeat(withTiming(1, { duration: 1800, easing: Easing.inOut(Easing.quad) }), -1, true));
  }, [sweep]);

  const lineStyle = useAnimatedStyle(() => ({ transform: [{ translateY: 12 + sweep.get() * (FRAME - 24) }] }));
  const corner = { position: 'absolute' as const, width: CORNER, height: CORNER, borderColor: SCAN_ACCENT };

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill} className="items-center justify-center">
      <View style={{ width: FRAME, height: FRAME, borderRadius: 22, boxShadow: '0 0 0 2000px rgba(0, 0, 0, 0.45)' }}>
        <View style={[corner, { top: 0, left: 0, borderTopWidth: CORNER_WIDTH, borderLeftWidth: CORNER_WIDTH, borderTopLeftRadius: 22 }]} />
        <View style={[corner, { top: 0, right: 0, borderTopWidth: CORNER_WIDTH, borderRightWidth: CORNER_WIDTH, borderTopRightRadius: 22 }]} />
        <View style={[corner, { bottom: 0, left: 0, borderBottomWidth: CORNER_WIDTH, borderLeftWidth: CORNER_WIDTH, borderBottomLeftRadius: 22 }]} />
        <View style={[corner, { bottom: 0, right: 0, borderBottomWidth: CORNER_WIDTH, borderRightWidth: CORNER_WIDTH, borderBottomRightRadius: 22 }]} />
        <Animated.View
          style={[
            { position: 'absolute', left: -12, right: -12, top: 0, height: 2, borderRadius: 1, backgroundColor: SCAN_ACCENT, boxShadow: `0 0 10px 2px ${SCAN_ACCENT}` },
            lineStyle,
          ]}
        />
      </View>
    </View>
  );
}

/** No camera: no permission, or a build without the native module. */
function Blocked({ message, action, onAction }: { message: string; action?: string; onAction?: () => void }) {
  return (
    <View className="flex-1 items-center justify-center gap-5 px-8">
      <View className="h-16 w-16 items-center justify-center rounded-full bg-white/10">
        <Icon icon={CameraIcon} size={28} rawColor="#FFFFFF" />
      </View>
      <Text className="text-center" style={{ color: '#FFFFFF', fontSize: 14.5, lineHeight: 21 }}>
        {message}
      </Text>
      {action && onAction ? <Button testID="guest-scan-permission" variant="inverse" size="lg" pill label={action} onPress={onAction} /> : null}
    </View>
  );
}
