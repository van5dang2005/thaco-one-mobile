import { openApplication } from 'expo-intent-launcher';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Alert, Linking, Platform } from 'react-native';

import { useCapabilities } from '@/core/session/capabilities';
import { useSessionStore } from '@/core/session/sessionStore';

import { type HomeModule, nativeModules } from '../modules';
import { orderModules, useHomePrefs } from '../store/homePrefs';
import { appModules, filterModules } from '../utils/moduleFilter';
import type { Signal } from './useSignals';

/** Modules the user may see (apps the portal grants, permissions), in their default order. */
export function useAvailableModules() {
  const { has } = useCapabilities();
  const apps = useSessionStore((s) => s.apps);
  const connected = useSessionStore((s) => s.connected);
  return filterModules(appModules(apps, nativeModules), { connected, has });
}

/** `useAvailableModules` in the user's order. */
export function useHomeModules() {
  const modules = useAvailableModules();
  const order = useHomePrefs((s) => s.order);
  return orderModules(modules, order);
}

export type ModuleSignals = Record<string, { badge?: Signal<number>; summary?: Signal<string> }>;

/**
 * Badge and summary of every tile with screens here (web apps have none). `nativeModules` is a constant,
 * so the hooks below run in the same order on every render. Opted out of React Compiler, which only
 * recognises `use*` names.
 */
export function useModuleSignals(): ModuleSignals {
  'use no memo';
  const signals: ModuleSignals = {};
  for (const module of nativeModules) {
    signals[module.id] = { badge: module.badge?.(), summary: module.summary?.() };
  }
  return signals;
}

export function useModuleLabel() {
  const { t } = useTranslation();
  return (module: HomeModule, short = false) => {
    if (module.title !== undefined) return (short && module.shortTitle) || module.title;
    return t(`home.modules.${short && module.shortLabelKey ? module.shortLabelKey : module.labelKey}`);
  };
}

export function useOpenModule() {
  const { t } = useTranslation();
  const label = useModuleLabel();

  const openExternal = async (module: HomeModule) => {
    try {
      // Throws when the package is not installed (or not visible: app.config `queries`).
      if (Platform.OS === 'android' && module.androidPackage) openApplication(module.androidPackage);
      else await Linking.openURL(module.externalUrl!);
    } catch {
      const store = module.storeUrl;
      Alert.alert(
        label(module),
        store ? t('home.externalMissing', { name: label(module) }) : t('home.externalFailed', { name: label(module) }),
        store
          ? [
              { text: t('common.cancel'), style: 'cancel' },
              { text: t('home.openStore'), onPress: () => void Linking.openURL(Platform.OS === 'ios' ? store.ios : store.android) },
            ]
          : [{ text: t('common.ok') }],
      );
    }
  };

  return (module: HomeModule) => {
    if (module.externalUrl) {
      void openExternal(module);
    } else if (module.route) {
      module.onBeforeOpen?.();
      router.push(module.route);
    }
  };
}
