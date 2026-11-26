import { Pressable, StyleSheet, Text } from 'react-native';
import { Tabs } from 'expo-router';
import { esStaff } from '../../domain/auth/roles';
import { useAuth } from '../../providers/AuthProvider';

/**
 * Pestañas por rol (Spec 08, US-08.4). `Tabs.Protected` impide además abrir por URL una ruta de
 * otro rol: se redirige a la pestaña inicial del rol (Resumen o Pasaporte). Es solo UX; la autorización real es RLS.
 * STAFF: Resumen, Mapa y Puertas. ATTENDEE, VIP y EXHIBITOR: Pasaporte, Escáner y Mapa.
 * El orden de declaración es el orden de la barra (ver `pestanasPorRol`).
 */
export default function TabsLayout() {
  const { rol } = useAuth();
  const staff = rol !== null && esStaff(rol);

  return (
    <Tabs
      screenOptions={{
        headerShown: true,
        headerRight: () => <BotonCerrarSesion />,
        tabBarActiveTintColor: '#13695F',
        tabBarInactiveTintColor: '#5A6A64',
      }}
    >
      {/* Sin redirectTo, Expo Router llevaría a otra pestaña cualquiera (p. ej. NFC). */}
      <Tabs.Protected guard={staff} redirectTo="/pasaporte">
        <Tabs.Screen name="index" options={{ title: 'Resumen', tabBarLabel: 'Resumen' }} />
      </Tabs.Protected>
      <Tabs.Protected guard={!staff} redirectTo="/">
        <Tabs.Screen name="pasaporte" options={{ title: 'Pasaporte', tabBarLabel: 'Pasaporte' }} />
        <Tabs.Screen name="escaner" options={{ title: 'Escáner', tabBarLabel: 'Escáner' }} />
      </Tabs.Protected>
      <Tabs.Screen name="mapa" options={{ title: 'Mapa', tabBarLabel: 'Mapa' }} />
      <Tabs.Protected guard={staff} redirectTo="/pasaporte">
        <Tabs.Screen name="puertas" options={{ title: 'Puertas', tabBarLabel: 'Puertas' }} />
      </Tabs.Protected>
      {/* Prueba de concepto NFC (Spec 02): solo visible en desarrollo. */}
      <Tabs.Screen
        name="nfc"
        options={{ title: 'NFC', tabBarLabel: 'NFC', href: __DEV__ ? undefined : null }}
      />
    </Tabs>
  );
}

function BotonCerrarSesion() {
  const { logout } = useAuth();
  return (
    <Pressable
      onPress={() => void logout()}
      accessibilityRole="button"
      accessibilityLabel="Cerrar sesión"
      hitSlop={8}
      style={styles.boton}
    >
      <Text style={styles.texto}>Cerrar sesión</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  boton: { paddingHorizontal: 16, paddingVertical: 8 },
  texto: { color: '#13695F', fontSize: 15, fontWeight: '600' },
});
