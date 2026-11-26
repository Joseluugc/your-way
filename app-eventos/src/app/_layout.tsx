import { Stack } from 'expo-router';
import { SQLiteProvider } from 'expo-sqlite';
import { StatusBar } from 'expo-status-bar';
import { initializeAppDatabase } from '../database/initializeDatabase';
import { AuthProvider, useAuth } from '../providers/AuthProvider';
import { GamificationProvider } from '../providers/GamificationProvider';
import { NotificationProvider } from '../providers/NotificationProvider';
import { SyncProvider } from '../providers/SyncProvider';

export default function RootLayout() {
  return (
    <SQLiteProvider
      databaseName="your-way-v2.db"
      onInit={initializeAppDatabase}
      options={{ enableChangeListener: true }}
    >
      <AuthProvider>
        <SyncProvider>
          <GamificationProvider>
            <NotificationProvider>
              <StatusBar style="auto" />
              <RootNavigator />
            </NotificationProvider>
          </GamificationProvider>
        </SyncProvider>
      </AuthProvider>
    </SQLiteProvider>
  );
}

/** Sin sesión solo existe `login`; con sesión, solo las pestañas (Spec 08, US-08.1). */
function RootNavigator() {
  const { estado } = useAuth();

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={estado === 'con-sesion'}>
        <Stack.Screen name="(tabs)" />
      </Stack.Protected>
      <Stack.Protected guard={estado === 'sin-sesion'}>
        <Stack.Screen name="login" />
      </Stack.Protected>
    </Stack>
  );
}
