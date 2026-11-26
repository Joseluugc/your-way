import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../providers/AuthProvider';

type Modo = 'entrar' | 'registro';

/** Cuentas demo de supabase/seed_auth.sql. Solo se usan en desarrollo (`__DEV__`). */
const CONTRASENA_DEMO = 'yourway-demo';
const CUENTAS_DEMO = [
  { etiqueta: 'Entrar como Elena (STAFF)', email: 'elena.navarro@yourway.demo' },
  { etiqueta: 'Entrar como Ana (ATTENDEE)', email: 'ana.gomez@yourway.demo' },
] as const;

export default function LoginScreen() {
  const { login, register, aviso } = useAuth();
  const [modo, setModo] = useState<Modo>('entrar');
  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const registro = modo === 'registro';

  async function ejecutar(operacion: () => Promise<string | null>) {
    setEnviando(true);
    setError(null);
    try {
      setError(await operacion());
    } finally {
      setEnviando(false);
    }
  }

  function enviar() {
    void ejecutar(() => (registro ? register(nombre, email, password) : login(email, password)));
  }

  function cambiarModo() {
    setModo(registro ? 'entrar' : 'registro');
    setError(null);
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <Text style={styles.titulo} accessibilityRole="header">
            Your Way
          </Text>
          <Text style={styles.subtitulo}>{registro ? 'Crea tu cuenta' : 'Inicia sesión'}</Text>

          {aviso ? (
            <Text style={styles.aviso} accessibilityLiveRegion="polite">
              {aviso}
            </Text>
          ) : null}

          {registro ? (
            <>
              <Text style={styles.label}>Nombre</Text>
              <TextInput
                style={styles.input}
                value={nombre}
                onChangeText={setNombre}
                autoComplete="name"
                textContentType="name"
                accessibilityLabel="Nombre, obligatorio"
              />
            </>
          ) : null}

          <Text style={styles.label}>Email</Text>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="email"
            keyboardType="email-address"
            textContentType="emailAddress"
            accessibilityLabel="Email"
          />

          <Text style={styles.label}>Contraseña</Text>
          <TextInput
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete={registro ? 'new-password' : 'current-password'}
            textContentType={registro ? 'newPassword' : 'password'}
            accessibilityLabel="Contraseña, mínimo 6 caracteres"
            onSubmitEditing={enviar}
          />

          {error ? (
            <Text style={styles.error} accessibilityRole="alert">
              {error}
            </Text>
          ) : null}

          <Pressable
            style={[styles.botonPrincipal, enviando && styles.deshabilitado]}
            onPress={enviar}
            disabled={enviando}
            accessibilityRole="button"
            accessibilityLabel={registro ? 'Crear cuenta' : 'Entrar'}
            accessibilityState={{ disabled: enviando, busy: enviando }}
          >
            {enviando ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.botonPrincipalTexto}>{registro ? 'Crear cuenta' : 'Entrar'}</Text>
            )}
          </Pressable>

          <Pressable onPress={cambiarModo} accessibilityRole="button" style={styles.enlace}>
            <Text style={styles.enlaceTexto}>
              {registro ? '¿Ya tienes cuenta? Inicia sesión' : '¿No tienes cuenta? Regístrate'}
            </Text>
          </Pressable>

          {__DEV__ ? (
            <View style={styles.demo}>
              <Text style={styles.demoTitulo}>Accesos rápidos (solo desarrollo)</Text>
              {CUENTAS_DEMO.map((cuenta) => (
                <Pressable
                  key={cuenta.email}
                  style={[styles.botonDemo, enviando && styles.deshabilitado]}
                  onPress={() => void ejecutar(() => login(cuenta.email, CONTRASENA_DEMO))}
                  disabled={enviando}
                  accessibilityRole="button"
                >
                  <Text style={styles.botonDemoTexto}>{cuenta.etiqueta}</Text>
                </Pressable>
              ))}
            </View>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#FFFFFF' },
  flex: { flex: 1 },
  container: { padding: 24, flexGrow: 1, justifyContent: 'center' },
  titulo: { fontSize: 28, fontWeight: '800', color: '#13695F', textAlign: 'center' },
  subtitulo: { fontSize: 17, color: '#304A44', textAlign: 'center', marginTop: 4, marginBottom: 24 },
  aviso: { backgroundColor: '#FFF4E0', color: '#7A4A00', padding: 12, borderRadius: 8, marginBottom: 16, fontSize: 14 },
  label: { fontSize: 13, marginBottom: 6, fontWeight: '600', color: '#304A44' },
  input: { borderWidth: 1, borderColor: '#7E8E88', borderRadius: 8, padding: 12, marginBottom: 16, fontSize: 15, backgroundColor: '#F8FAF9', color: '#173A35' },
  error: { color: '#B3261E', fontSize: 14, marginBottom: 12 },
  botonPrincipal: { backgroundColor: '#13695F', paddingVertical: 14, borderRadius: 8, alignItems: 'center', marginTop: 4 },
  botonPrincipalTexto: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  deshabilitado: { opacity: 0.6 },
  enlace: { paddingVertical: 14, alignItems: 'center' },
  enlaceTexto: { color: '#13695F', fontSize: 14, fontWeight: '600' },
  demo: { marginTop: 24, borderTopWidth: 1, borderTopColor: '#E5EBE8', paddingTop: 16, gap: 10 },
  demoTitulo: { fontSize: 13, color: '#5A6A64', textAlign: 'center' },
  botonDemo: { borderWidth: 1, borderColor: '#13695F', paddingVertical: 12, borderRadius: 8, alignItems: 'center' },
  botonDemoTexto: { color: '#13695F', fontSize: 15, fontWeight: '600' },
});
