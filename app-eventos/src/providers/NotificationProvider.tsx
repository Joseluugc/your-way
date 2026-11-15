import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSQLiteContext } from 'expo-sqlite';
import * as Notifications from 'expo-notifications';
import { AndroidImportance } from 'expo-notifications';
import { AlertRepository } from '../database/AlertRepository';
import {
  isOrganizationAlertType,
  type OrganizationAlert,
} from '../domain/notifications/organizationAlert';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

type PermissionState = 'unknown' | 'granted' | 'denied' | 'unavailable';

interface NotificationContextValue {
  alerts: OrganizationAlert[];
  banner: OrganizationAlert | null;
  permissionState: PermissionState;
  error: string | null;
  requestPermission: () => Promise<boolean>;
  dismissBanner: () => void;
  publishAlert: (alert: OrganizationAlert) => Promise<void>;
}

const NotificationContext = createContext<NotificationContextValue | null>(null);

export function NotificationProvider({ children }: PropsWithChildren) {
  const database = useSQLiteContext();
  const [alerts, setAlerts] = useState<OrganizationAlert[]>([]);
  const [banner, setBanner] = useState<OrganizationAlert | null>(null);
  const [permissionState, setPermissionState] = useState<PermissionState>(
    Platform.OS === 'web' ? 'unavailable' : 'unknown',
  );
  const [error, setError] = useState<string | null>(null);

  const persistAlert = useCallback(
    async (alert: OrganizationAlert) => {
      await new AlertRepository(database).save(alert);
      setAlerts((current) => [
        alert,
        ...current.filter((savedAlert) => savedAlert.id !== alert.id),
      ]);
      setBanner(alert);
      setError(null);
    },
    [database],
  );

  const receiveNotification = useCallback(
    async (notification: Notifications.Notification) => {
      const content = notification.request.content;
      const data: unknown = content.data;
      if (!isRecord(data) || !isOrganizationAlertType(data.type)) {
        return;
      }

      const alert = parseAlert(data, content.title, content.body, notification.date, notification.request.identifier);
      if (alert) {
        await persistAlert(alert);
      }
    },
    [persistAlert],
  );

  useEffect(() => {
    let active = true;
    const repository = new AlertRepository(database);
    void repository
      .getLatest()
      .then((savedAlerts) => {
        if (active) {
          setAlerts(savedAlerts);
        }
      })
      .catch((loadError: unknown) => {
        if (active) {
          setError(errorMessage(loadError, 'No se pudieron cargar los avisos guardados.'));
        }
      });

    if (Platform.OS === 'web') {
      return () => {
        active = false;
      };
    }

    void Notifications.getPermissionsAsync()
      .then(({ status }) => {
        if (active) {
          setPermissionState(status === 'granted' ? 'granted' : status === 'denied' ? 'denied' : 'unknown');
        }
      })
      .catch((permissionError: unknown) => {
        if (active) {
          setError(errorMessage(permissionError, 'No se pudo consultar el permiso de notificaciones.'));
        }
      });

    const subscription = Notifications.addNotificationReceivedListener((notification) => {
      void receiveNotification(notification).catch((receiveError: unknown) => {
        setError(errorMessage(receiveError, 'No se pudo guardar el aviso recibido.'));
      });
    });

    return () => {
      active = false;
      subscription.remove();
    };
  }, [database, receiveNotification]);

  const requestPermission = useCallback(async () => {
    if (Platform.OS === 'web') {
      setPermissionState('unavailable');
      return false;
    }

    try {
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('event-updates', {
          name: 'Avisos del evento',
          importance: AndroidImportance.HIGH,
        });
      }

      const current = await Notifications.getPermissionsAsync();
      const result =
        current.status === 'granted' ? current : await Notifications.requestPermissionsAsync();
      const granted = result.status === 'granted';
      setPermissionState(granted ? 'granted' : 'denied');
      setError(null);
      return granted;
    } catch (permissionError: unknown) {
      setPermissionState('unavailable');
      setError(errorMessage(permissionError, 'No se pudo activar el permiso de notificaciones.'));
      return false;
    }
  }, []);

  const publishAlert = useCallback(
    async (alert: OrganizationAlert) => {
      await persistAlert(alert);

      if (permissionState === 'granted') {
        await Notifications.scheduleNotificationAsync({
          content: {
            title: alert.title,
            body: alert.message,
            data: {
              id: alert.id,
              type: alert.type,
              zone_id: alert.zone_id,
              created_at: alert.created_at,
            },
          },
          trigger: null,
        });
      }
    },
    [permissionState, persistAlert],
  );

  const contextValue = useMemo<NotificationContextValue>(
    () => ({
      alerts,
      banner,
      permissionState,
      error,
      requestPermission,
      dismissBanner: () => setBanner(null),
      publishAlert,
    }),
    [alerts, banner, permissionState, error, requestPermission, publishAlert],
  );

  return (
    <NotificationContext.Provider value={contextValue}>
      {children}
      {banner ? (
        <View pointerEvents="box-none" style={styles.bannerContainer}>
          <View accessibilityLiveRegion="polite" style={styles.banner}>
            <View style={styles.bannerCopy}>
              <Text style={styles.bannerTitle}>{banner.title}</Text>
              <Text numberOfLines={2} style={styles.bannerMessage}>{banner.message}</Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Cerrar aviso"
              onPress={() => setBanner(null)}
              style={styles.closeButton}
            >
              <Text style={styles.closeText}>×</Text>
            </Pressable>
          </View>
        </View>
      ) : null}
    </NotificationContext.Provider>
  );
}

export function useEventNotifications(): NotificationContextValue {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useEventNotifications debe usarse dentro de NotificationProvider.');
  }

  return context;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseAlert(
  data: Record<string, unknown>,
  notificationTitle: string | null,
  notificationBody: string | null,
  notificationDate: number,
  notificationId: string,
): OrganizationAlert | null {
  const type = data.type;
  const title = typeof data.title === 'string' ? data.title : notificationTitle;
  const message =
    typeof data.message === 'string'
      ? data.message
      : typeof data.body === 'string'
        ? data.body
        : notificationBody;

  if (!isOrganizationAlertType(type) || !title || !message) {
    return null;
  }

  const zoneId = data.zone_id;
  const timestamp = data.created_at;

  return {
    id: typeof data.id === 'string' ? data.id : notificationId,
    type,
    title,
    message,
    zone_id: typeof zoneId === 'string' ? zoneId : null,
    created_at:
      typeof timestamp === 'string'
        ? timestamp
        : new Date(notificationDate * 1000).toISOString(),
  };
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? `${fallback} ${error.message}` : fallback;
}

const styles = StyleSheet.create({
  bannerContainer: {
    position: 'absolute',
    top: 8,
    left: 16,
    right: 16,
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    backgroundColor: '#173A35',
    paddingHorizontal: 16,
    paddingVertical: 13,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
  bannerCopy: { flex: 1 },
  bannerTitle: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  bannerMessage: { color: '#E8F2EF', fontSize: 12, marginTop: 3 },
  closeButton: { paddingHorizontal: 8, paddingVertical: 3 },
  closeText: { color: '#FFFFFF', fontSize: 24, lineHeight: 26 },
});
