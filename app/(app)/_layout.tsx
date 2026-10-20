import { Stack } from 'expo-router';

import { PushNotificationsProvider, RealtimeProvider } from '@/features/notification';

export default function AppLayout() {
  return (
    <>
      <RealtimeProvider />
      <PushNotificationsProvider />
      <Stack screenOptions={{ headerShown: false }} />
    </>
  );
}
