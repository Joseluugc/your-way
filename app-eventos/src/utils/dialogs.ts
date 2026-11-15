import { Alert, Platform } from 'react-native';

// En react-native-web `Alert.alert` no muestra nada, así que en web
// usamos los diálogos del navegador.
const webWindow = globalThis as unknown as {
  alert?: (message: string) => void;
  confirm?: (message: string) => boolean;
};

/** Muestra un aviso informativo en cualquier plataforma. */
export function showMessage(title: string, message: string): void {
  if (Platform.OS === 'web') {
    webWindow.alert?.(`${title}\n\n${message}`);
    return;
  }
  Alert.alert(title, message);
}

/** Pide confirmación y ejecuta `onConfirm` si el usuario acepta. */
export function confirmAction(
  title: string,
  message: string,
  confirmLabel: string,
  onConfirm: () => void,
): void {
  if (Platform.OS === 'web') {
    if (webWindow.confirm?.(`${title}\n\n${message}`)) onConfirm();
    return;
  }
  Alert.alert(title, message, [
    { text: 'Cancelar', style: 'cancel' },
    { text: confirmLabel, style: 'destructive', onPress: onConfirm },
  ]);
}
