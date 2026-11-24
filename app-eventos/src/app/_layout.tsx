import { Tabs } from 'expo-router';
import { SQLiteProvider } from 'expo-sqlite';
import { StatusBar } from 'expo-status-bar';
import { initializeAppDatabase } from '../database/initializeDatabase';
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
      <SyncProvider>
        <GamificationProvider>
          <NotificationProvider>
            <StatusBar style="auto" />
            <Tabs
              screenOptions={{
                headerShown: false,
                tabBarActiveTintColor: '#167B71',
                tabBarInactiveTintColor: '#71827D',
              }}
            >
              <Tabs.Screen name="index" options={{ title: 'Resumen', tabBarLabel: 'Resumen' }} />
              <Tabs.Screen name="mapa" options={{ title: 'Mapa', tabBarLabel: 'Mapa' }} />
              {/* Prueba de concepto NFC (Spec 02): solo visible en desarrollo. */}
              <Tabs.Screen
                name="nfc"
                options={{ title: 'NFC', tabBarLabel: 'NFC', href: __DEV__ ? undefined : null }}
              />
            </Tabs>
          </NotificationProvider>
        </GamificationProvider>
      </SyncProvider>
    </SQLiteProvider>
  );
}
