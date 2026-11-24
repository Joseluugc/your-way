import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { Alert, Platform } from 'react-native';
import { confirmAction, showMessage } from '../../src/utils/dialogs';

const originalOS = Platform.OS;
const setOS = (os: typeof Platform.OS) =>
  Object.defineProperty(Platform, 'OS', { configurable: true, get: () => os });
const browser = globalThis as unknown as {
  alert?: (message: string) => void;
  confirm?: (message: string) => boolean;
};

describe('[US-07.1] avisos y confirmaciones multiplataforma', () => {
  afterEach(() => {
    setOS(originalOS);
    delete browser.alert;
    delete browser.confirm;
    jest.restoreAllMocks();
  });

  it('[US-07.1] en el móvil usa Alert nativo', () => {
    setOS('android');
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);

    showMessage('Éxito', 'Evento guardado correctamente.');

    expect(alert).toHaveBeenCalledWith('Éxito', 'Evento guardado correctamente.');
  });

  it('[US-07.1] en web usa el aviso del navegador (Alert no hace nada en web)', () => {
    setOS('web');
    browser.alert = jest.fn();

    showMessage('Error', 'Hubo un problema.');

    expect(browser.alert).toHaveBeenCalledWith('Error\n\nHubo un problema.');
  });

  it('[US-07.1] en el móvil la confirmación ejecuta la acción solo con el botón destructivo', () => {
    setOS('ios');
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    const onConfirm = jest.fn();

    confirmAction('Eliminar evento', '¿Seguro?', 'Eliminar', onConfirm);

    const buttons = alert.mock.calls[0][2] ?? [];
    expect(buttons.map((button) => button.text)).toEqual(['Cancelar', 'Eliminar']);
    expect(onConfirm).not.toHaveBeenCalled();
    buttons[1].onPress?.();
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('[US-07.1] en web la confirmación respeta la respuesta del usuario', () => {
    setOS('web');
    const onConfirm = jest.fn();

    browser.confirm = jest.fn(() => false);
    confirmAction('Eliminar evento', '¿Seguro?', 'Eliminar', onConfirm);
    expect(onConfirm).not.toHaveBeenCalled();

    browser.confirm = jest.fn(() => true);
    confirmAction('Eliminar evento', '¿Seguro?', 'Eliminar', onConfirm);
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });
});
