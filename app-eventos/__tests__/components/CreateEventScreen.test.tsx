import { afterAll, beforeAll, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import CreateEventScreen from '../../src/screens/CreateEventScreen';
import { insertEvent } from '../../src/database/eventQueries';
import { showMessage } from '../../src/utils/dialogs';

const mockRequestSync = jest.fn();

jest.mock('expo-sqlite', () => ({ useSQLiteContext: () => ({}) }));
jest.mock('../../src/providers/SyncProvider', () => ({
  useSync: () => ({ requestSync: mockRequestSync }),
}));
jest.mock('../../src/utils/dialogs', () => ({ showMessage: jest.fn() }));
jest.mock('../../src/database/eventQueries', () => ({
  insertEvent: jest.fn(async () => undefined),
  getEventos: jest.fn(async () => []),
  generateEventId: () => 'e0000000-0000-4000-8000-0000000000aa',
}));
// El selector nativo no existe en Jest: el campo se sustituye por una entrada de texto
// que recibe una fecha ISO y la entrega como `Date`, igual que el selector real.
jest.mock('../../src/components/DateTimeField', () => {
  const { TextInput } = require('react-native');
  return function MockDateTimeField(props: { label: string; onChange: (value: Date) => void }) {
    return (
      <TextInput
        accessibilityLabel={props.label}
        onChangeText={(text: string) => props.onChange(new Date(text))}
      />
    );
  };
});

const mockedInsertEvent = jest.mocked(insertEvent);
const mockedShowMessage = jest.mocked(showMessage);

async function fillRequiredFields() {
  await fireEvent.changeText(screen.getByPlaceholderText('Ej. Conferencia Tech'), '  Charla QA  ');
  await fireEvent.changeText(screen.getByPlaceholderText('Ej. Auditorio Principal'), ' Sala 2 ');
}

const save = () => fireEvent.press(screen.getByText('Guardar Evento'));
const setField = (label: string, date: Date) =>
  fireEvent.changeText(screen.getByLabelText(label), date.toISOString());

describe('[US-07.1] CreateEventScreen: validación del formulario', () => {
  beforeAll(() => {
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });
  afterAll(() => {
    jest.restoreAllMocks();
  });
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('[US-07.1] sin título ni ubicación no guarda y avisa de campos incompletos', async () => {
    await render(<CreateEventScreen />);
    await save();

    await waitFor(() =>
      expect(mockedShowMessage).toHaveBeenCalledWith('Campos incompletos', expect.any(String)),
    );
    expect(mockedInsertEvent).not.toHaveBeenCalled();
  });

  it('[US-07.1] un título o una ubicación solo con espacios cuentan como vacíos', async () => {
    await render(<CreateEventScreen />);
    await fireEvent.changeText(screen.getByPlaceholderText('Ej. Conferencia Tech'), '   ');
    await fireEvent.changeText(screen.getByPlaceholderText('Ej. Auditorio Principal'), 'Sala 2');
    await save();

    await waitFor(() =>
      expect(mockedShowMessage).toHaveBeenCalledWith('Campos incompletos', expect.any(String)),
    );
    expect(mockedInsertEvent).not.toHaveBeenCalled();
  });

  it('[US-07.1] rechaza una hora de fin anterior a la de inicio', async () => {
    await render(<CreateEventScreen />);
    await fillRequiredFields();
    await setField('Hora de fin *', new Date(2026, 10, 15, 9, 0));
    await save();

    await waitFor(() =>
      expect(mockedShowMessage).toHaveBeenCalledWith('Error de horario', expect.any(String)),
    );
    expect(mockedInsertEvent).not.toHaveBeenCalled();
  });

  it('[US-07.1] rechaza un evento que empieza y termina a la misma hora', async () => {
    await render(<CreateEventScreen />);
    await fillRequiredFields();
    await setField('Hora de fin *', new Date(2026, 10, 15, 10, 0));
    await save();

    await waitFor(() =>
      expect(mockedShowMessage).toHaveBeenCalledWith('Error de horario', expect.any(String)),
    );
    expect(mockedInsertEvent).not.toHaveBeenCalled();
  });

  it('[US-07.1] rechaza una fecha de fin anterior a la de inicio', async () => {
    await render(<CreateEventScreen />);
    await fillRequiredFields();
    await setField('Fecha de fin *', new Date(2026, 10, 14));
    await save();

    await waitFor(() =>
      expect(mockedShowMessage).toHaveBeenCalledWith('Error de horario', expect.any(String)),
    );
    expect(mockedInsertEvent).not.toHaveBeenCalled();
  });

  it('[US-07.1] guarda un evento válido, pide sincronizar y cierra el formulario', async () => {
    const onClose = jest.fn();
    await render(<CreateEventScreen onClose={onClose} />);
    await fillRequiredFields();
    await setField('Fecha de fin *', new Date(2026, 10, 16));
    await setField('Hora de fin *', new Date(2026, 10, 16, 9, 30));
    await save();

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(mockedInsertEvent).toHaveBeenCalledWith(
      expect.anything(),
      {
        id: 'e0000000-0000-4000-8000-0000000000aa',
        titulo: 'Charla QA',
        fecha_inicio: new Date(2026, 10, 15, 10, 0).toISOString(),
        fecha_fin: new Date(2026, 10, 16, 9, 30).toISOString(),
        ubicacion: 'Sala 2',
        descripcion: null,
      },
    );
    expect(mockRequestSync).toHaveBeenCalledTimes(1);
    expect(mockedShowMessage).toHaveBeenCalledWith('Éxito', 'Evento guardado correctamente.');
  });

  it('[US-07.1] une los saltos de línea de la descripción con guiones', async () => {
    await render(<CreateEventScreen />);
    await fillRequiredFields();
    await fireEvent.changeText(screen.getByPlaceholderText('Añade detalles...'), 'Línea 1\n\nLínea 2');
    await save();

    await waitFor(() => expect(mockedInsertEvent).toHaveBeenCalled());
    expect(mockedInsertEvent.mock.calls[0][1].descripcion).toBe('Línea 1 - Línea 2');
  });

  it('[US-07.1] si falla el guardado avisa del error y no cierra el formulario', async () => {
    mockedInsertEvent.mockRejectedValueOnce(new Error('disco lleno'));
    const onClose = jest.fn();
    await render(<CreateEventScreen onClose={onClose} />);
    await fillRequiredFields();
    await save();

    await waitFor(() => expect(mockedShowMessage).toHaveBeenCalledWith('Error', expect.any(String)));
    expect(onClose).not.toHaveBeenCalled();
    expect(mockRequestSync).not.toHaveBeenCalled();
  });
});
