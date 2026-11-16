import { Tabs } from 'expo-router';
import { SQLiteProvider } from 'expo-sqlite';
import { StatusBar } from 'expo-status-bar';
import { initializeAppDatabase } from '../database/initializeDatabase';
import { NotificationProvider } from '../providers/NotificationProvider';

export default function RootLayout() {
  return (
    <SQLiteProvider
      databaseName="your-way-v2.db"
      onInit={initializeAppDatabase}
      options={{ enableChangeListener: true }}
    >
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
        </Tabs>
      </NotificationProvider>
    </SQLiteProvider>
  );
}
