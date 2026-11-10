import { StatusBar } from 'expo-status-bar';
import { SQLiteProvider } from 'expo-sqlite';
import OrganizerDashboardScreen from './src/screens/OrganizerDashboardScreen';
import { initializeAppDatabase } from './src/database/initializeDatabase';

export default function App() {
  return (
    <SQLiteProvider databaseName="your-way.db" onInit={initializeAppDatabase}>
      <OrganizerDashboardScreen />
      <StatusBar style="auto" />
    </SQLiteProvider>
  );
}
