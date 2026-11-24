import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { AccessibilityInfo, Pressable, Text, View } from 'react-native';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import * as Haptics from 'expo-haptics';
import NfcResultBanner from '../../src/components/NfcResultBanner';
import type { NfcReadResult } from '../../src/domain/nfc/nfcFeedback';
import { useNfcFeedback } from '../../src/hooks/useNfcFeedback';
import {
  findContrastIssues,
  findUnlabeledInteractive,
  formatContrastIssues,
  type HostNode,
} from '../helpers/accessibilityAudit';

// API real de expo-haptics (enum NotificationFeedbackType); solo se sustituye la llamada nativa.
jest.mock('expo-haptics', () => ({
  ...jest.requireActual<object>('expo-haptics'),
  notificationAsync: jest.fn(async () => undefined),
}));

const mockedNotification = jest.mocked(Haptics.notificationAsync);

function Harness() {
  const { feedback, present, dismiss } = useNfcFeedback();
  const results: NfcReadResult[] = ['SUCCESS', 'ACCESS_DENIED', 'READ_ERROR'];
  return (
    <View>
      {results.map((result) => (
        <Pressable
          key={result}
          accessibilityRole="button"
          accessibilityLabel={`Simular ${result}`}
          onPress={() => present(result, result === 'ACCESS_DENIED' ? 'Zona: Backstage Staff.' : undefined)}
        >
          <Text>{result}</Text>
        </Pressable>
      ))}
      <NfcResultBanner feedback={feedback} onDismiss={dismiss} />
    </View>
  );
}

describe('[US-06.3] respuesta a una lectura NFC: vibración, pantalla y lector', () => {
  let announce: jest.SpiedFunction<typeof AccessibilityInfo.announceForAccessibility>;

  beforeEach(() => {
    jest.clearAllMocks();
    announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility').mockImplementation(() => undefined);
  });

  it.each([
    ['SUCCESS', Haptics.NotificationFeedbackType.Success, 'Lectura correcta'],
    ['ACCESS_DENIED', Haptics.NotificationFeedbackType.Error, 'Acceso denegado'],
    ['READ_ERROR', Haptics.NotificationFeedbackType.Warning, 'Error de lectura'],
  ] as const)('[US-06.3] %s vibra con %s, se muestra y se anuncia', async (result, haptic, title) => {
    await render(<Harness />);

    await fireEvent.press(screen.getByLabelText(`Simular ${result}`));

    expect(mockedNotification).toHaveBeenCalledWith(haptic);
    expect(screen.getByText(title)).toBeOnTheScreen();
    expect(announce).toHaveBeenCalledWith(expect.stringMatching(new RegExp(`^${title}\\. `)));
    const region = screen.getByRole('alert');
    expect(region.props.accessibilityLiveRegion).toBe('assertive');
    expect(region.props.accessibilityLabel).toBe(announce.mock.calls[0][0]);
  });

  it('[US-06.3] el aviso incluye el detalle y se puede cerrar', async () => {
    await render(<Harness />);
    await fireEvent.press(screen.getByLabelText('Simular ACCESS_DENIED'));

    expect(screen.getByText(/Zona: Backstage Staff\./)).toBeOnTheScreen();
    await fireEvent.press(screen.getByLabelText('Cerrar aviso de lectura'));
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('[US-06.3] sin motor háptico (web, emulador) el aviso visual y hablado siguen funcionando', async () => {
    mockedNotification.mockRejectedValueOnce(new Error('UnavailabilityError'));
    await render(<Harness />);

    await fireEvent.press(screen.getByLabelText('Simular SUCCESS'));

    await waitFor(() => expect(screen.getByText('Lectura correcta')).toBeOnTheScreen());
    expect(announce).toHaveBeenCalled();
  });

  it.each(['SUCCESS', 'ACCESS_DENIED', 'READ_ERROR'] as const)(
    '[US-06.3] el aviso %s cumple contraste y etiquetado',
    async (result) => {
      await render(<Harness />);
      await fireEvent.press(screen.getByLabelText(`Simular ${result}`));

      const root = screen.container as unknown as HostNode;
      expect(formatContrastIssues(findContrastIssues(root))).toEqual([]);
      expect(findUnlabeledInteractive(root)).toEqual([]);
    },
  );
});
