import '../global.css';
import '@/core/i18n';

import { defaultShouldDehydrateQuery, type Query } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import Constants from 'expo-constants';
import { useFonts } from 'expo-font';
import { DarkTheme, DefaultTheme, ThemeProvider as NavigationThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { startCrashReporting, useCrashBreadcrumbs } from '@/core/monitoring/crashReporting';
import { queryClient, queryPersister } from '@/core/query/queryClient';
import { restoreSession } from '@/core/session/session';
import { useSessionStore } from '@/core/session/sessionStore';
import { monoAssets, uiAssets } from '@/core/theme/fonts';
import { ThemeProvider, useTheme } from '@/core/theme/ThemeProvider';
import { UpdatePrompt } from '@/features/app-update/components/UpdatePrompt';
import { ToastHost } from '@/shared/ui/Toast';

startCrashReporting();
void SplashScreen.preventAutoHideAsync();

const persistOptions = {
  persister: queryPersister,
  maxAge: 24 * 60 * 60 * 1000,
  buster: Constants.expoConfig?.version ?? 'dev',
  // `meta: { persist: false }` keeps a query in memory only (whole staff lists).
  dehydrateOptions: { shouldDehydrateQuery: (query: Query) => defaultShouldDehydrateQuery(query) && query.meta?.persist !== false },
};

void restoreSession();

const startupFonts = { ...monoAssets, ...uiAssets };

function RootNavigator() {
  const { scheme, colors } = useTheme();
  const status = useSessionStore((s) => s.status);
  const signedIn = status === 'signedIn';
  useCrashBreadcrumbs();

  const navigationTheme = useMemo(() => {
    const base = scheme === 'dark' ? DarkTheme : DefaultTheme;
    return {
      ...base,
      colors: { ...base.colors, primary: colors.primary, background: colors.bg, card: colors.surface, text: colors.ink, border: colors.line },
    };
  }, [scheme, colors]);

  return (
    <NavigationThemeProvider value={navigationTheme}>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
        <Stack.Protected guard={signedIn}>
          <Stack.Screen name="(app)" />
        </Stack.Protected>
        <Stack.Protected guard={!signedIn}>
          <Stack.Screen name="(auth)" />
        </Stack.Protected>
      </Stack>
      <ToastHost />
      <UpdatePrompt />
    </NavigationThemeProvider>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts(startupFonts);
  const sessionStatus = useSessionStore((s) => s.status);
  const ready = (fontsLoaded || !!fontError) && sessionStatus !== 'loading';

  useEffect(() => {
    if (ready) void SplashScreen.hideAsync();
  }, [ready]);

  if (!ready) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <PersistQueryClientProvider client={queryClient} persistOptions={persistOptions}>
            <RootNavigator />
          </PersistQueryClientProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
