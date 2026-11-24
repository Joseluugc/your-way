import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { Platform } from 'react-native';
import { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import DateTimeField from '../../src/components/DateTimeField';
import { showMessage } from '../../src/utils/dialogs';

jest.mock('../../src/utils/dialogs', () => ({ showMessage: jest.fn() }));
// Selector nativo simulado: en iOS se renderiza en línea y avisa con `onValueChange`.
jest.mock('@react-native-community/datetimepicker', () => {
  const { Text } = require('react-native');
  function MockPicker(props: { mode: string; onValueChange: (event: unknown, date: Date) => void }) {
    return (
      <Text
        testID={`native-picker-${props.mode}`}
        onPress={() => props.onValueChange({}, new Date(2026, 10, 20, 18, 45))}
      >
        selector
      </Text>
    );
  }
  return { __esModule: true, default: MockPicker, DateTimePickerAndroid: { open: jest.fn() } };
});

const VALUE = new Date(2026, 10, 15, 10, 0);

function props(overrides: Partial<Parameters<typeof DateTimeField>[0]> = {}) {
  return {
    label: 'Fecha de inicio *',
    mode: 'date' as const,
    value: VALUE,
    displayText: '15/11/2026',
    open: false,
    onOpen: jest.fn(),
    onClose: jest.fn(),
    onChange: jest.fn(),
    ...overrides,
  };
}

describe('[US-07.1] DateTimeField: selector de fecha y hora', () => {
  const originalOS = Platform.OS;
  const setOS = (os: typeof Platform.OS) =>
    Object.defineProperty(Platform, 'OS', { configurable: true, get: () => os });

  beforeEach(() => {

    jest.clearAllMocks();

  });
  afterEach(() => {
    setOS(originalOS);
  });

  describe('iOS', () => {
    beforeEach(() => {
      setOS('ios');
    });

    it('[US-07.1] muestra la fecha y se anuncia con su etiqueta', async () => {
      await render(<DateTimeField {...props()} />);

      expect(screen.getByText('15/11/2026')).toBeOnTheScreen();
      expect(screen.getByLabelText('Fecha de inicio *: 15/11/2026')).toBeOnTheScreen();
    });

    it('[US-07.1] al pulsar abre el selector en línea', async () => {
      const onOpen = jest.fn();
      await render(<DateTimeField {...props({ onOpen })} />);

      await fireEvent.press(screen.getByLabelText('Fecha de inicio *: 15/11/2026'));
      expect(onOpen).toHaveBeenCalled();
    });

    it('[US-07.1] abierto, entrega la fecha elegida y "Listo" lo cierra', async () => {
      const onChange = jest.fn();
      const onClose = jest.fn();
      await render(<DateTimeField {...props({ open: true, onChange, onClose })} />);

      await fireEvent.press(screen.getByTestId('native-picker-date'));
      expect(onChange).toHaveBeenCalledWith(new Date(2026, 10, 20, 18, 45));

      await fireEvent.press(screen.getByText('Listo'));
      expect(onClose).toHaveBeenCalled();
    });

    it('[US-07.1] pulsar el campo abierto lo cierra', async () => {
      const onClose = jest.fn();
      await render(<DateTimeField {...props({ open: true, onClose })} />);

      await fireEvent.press(screen.getByLabelText('Fecha de inicio *: 15/11/2026'));
      expect(onClose).toHaveBeenCalled();
    });
  });

  describe('Android', () => {
    beforeEach(() => {
      setOS('android');
    });

    it('[US-07.1] al pulsar abre el diálogo nativo con la hora en formato 24 h', async () => {
      const onChange = jest.fn();
      const onClose = jest.fn();
      await render(<DateTimeField {...props({ mode: 'time', displayText: '10:00', onChange, onClose })} />);

      await fireEvent.press(screen.getByLabelText('Fecha de inicio *: 10:00'));

      const open = jest.mocked(DateTimePickerAndroid.open);
      expect(open).toHaveBeenCalledWith(
        expect.objectContaining({ value: VALUE, mode: 'time', is24Hour: true }),
      );
      const options = open.mock.calls[0][0];
      options.onValueChange?.({ nativeEvent: { timestamp: 0, utcOffset: 0 } }, new Date(2026, 10, 15, 11, 30));
      expect(onChange).toHaveBeenCalledWith(new Date(2026, 10, 15, 11, 30));
      options.onDismiss?.();
      expect(onClose).toHaveBeenCalled();
    });

    it('[US-07.1] si el diálogo no se puede abrir avisa del error', async () => {
      jest.spyOn(console, 'error').mockImplementation(() => undefined);
      jest.mocked(DateTimePickerAndroid.open).mockImplementationOnce(() => {
        throw new Error('sin actividad');
      });
      await render(<DateTimeField {...props()} />);

      await fireEvent.press(screen.getByLabelText('Fecha de inicio *: 15/11/2026'));

      expect(jest.mocked(showMessage)).toHaveBeenCalledWith(
        'Error',
        'No se pudo abrir el selector de fecha/hora.',
      );
    });
  });

  describe('web', () => {
    beforeEach(() => {
      setOS('web');
    });

    it('[US-07.1] usa el selector de fecha del navegador y convierte su valor', async () => {
      const onChange = jest.fn();
      await render(<DateTimeField {...props({ onChange })} />);

      const input = screen.getByLabelText('Fecha de inicio *', { includeHiddenElements: true });
      expect(input.props.value).toBe('2026-11-15');
      await fireEvent(input, 'change', { target: { value: '2026-12-01' } });

      const [selected] = onChange.mock.calls[0] as [Date];
      expect([selected.getFullYear(), selected.getMonth(), selected.getDate(), selected.getHours()]).toEqual([
        2026, 11, 1, 10,
      ]);
    });

    it('[US-07.1] convierte la hora del navegador conservando el día', async () => {
      const onChange = jest.fn();
      await render(<DateTimeField {...props({ mode: 'time', onChange })} />);

      const input = screen.getByLabelText('Fecha de inicio *', { includeHiddenElements: true });
      expect(input.props.value).toBe('10:00');
      await fireEvent(input, 'change', { target: { value: '17:25' } });

      expect(onChange).toHaveBeenCalledWith(new Date(2026, 10, 15, 17, 25));
    });

    it('[US-07.1] ignora un valor vacío del navegador', async () => {
      const onChange = jest.fn();
      await render(<DateTimeField {...props({ onChange })} />);

      await fireEvent(screen.getByLabelText('Fecha de inicio *', { includeHiddenElements: true }), 'change', {
        target: { value: '' },
      });
      expect(onChange).not.toHaveBeenCalled();
    });
  });
});
