import { StatusBar } from 'expo-status-bar';
import { SQLiteProvider } from 'expo-sqlite';
import { initializeAppDatabase } from './src/database/initializeDatabase';
import OrganizerDashboardScreen from './src/screens/OrganizerDashboardScreen';

export default function App() {
  return (
    <SQLiteProvider databaseName="your-way-v2.db" onInit={initializeAppDatabase}>
      <OrganizerDashboardScreen />
      <StatusBar style="auto" />
    </SQLiteProvider>
  );
}