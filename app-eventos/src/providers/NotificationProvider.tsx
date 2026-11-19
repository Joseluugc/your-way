import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren,
} from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSQLiteContext } from 'expo-sqlite';
import * as Notifications from 'expo-notifications';
import * as Linking from 'expo-linking';
import { useNetworkState } from 'expo-network';
import { NotificationRepository } from '../database/NotificationRepository';
import {
  acceptIncomingEventNotification,
  createDemoEventNotification,
  filterAndSortEventNotifications,
  type EventNotification,
  type EventNotificationType,
} from '../domain/notifications/eventNotification';

if (Platform.OS !== 'web') {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

export type NotificationPermissionState = 'unknown' | 'granted' | 'denied' | 'unavailable';

interface NotificationContextValue {
  notifications: EventNotification[];
  unreadCount: number;
  banner: EventNotification | null;
  permissionState: NotificationPermissionState;
  isOnline: boolean;
  canSimulate: boolean;
  error: string | null;
  requestPermission: () => Promise<boolean>;
  openSettings: () => Promise<void>;
  dismissBanner: () => void;
  markRead: (id: string) => Promise<void>;
  markAllRead: () => Promise<void>;
  simulateNotification: (
    type: EventNotificationType,
    relatedZoneId?: string | null,
  ) => Promise<boolean>;
}

const NotificationContext = createContext<NotificationContextValue | null>(null);

export function NotificationProvider({ children }: PropsWithChildren) {
  const database = useSQLiteContext();
  const networkState = useNetworkState();
  const isOnline =
    networkState.isConnected === true && networkState.isInternetReachable !== false;
  const [notifications, setNotifications] = useState<EventNotification[]>([]);
  const [banner, setBanner] = useState<EventNotification | null>(null);
  const [permissionState, setPermissionState] = useState<NotificationPermissionState>(
    Platform.OS === 'web' ? 'unavailable' : 'unknown',
  );
  const [error, setError] = useState<string | null>(null);
  const knownIds = useRef(new Set<string>());

  const storeNotification = useCallback(
    async (notification: EventNotification) => {
      if (knownIds.current.has(notification.id)) {
        return;
      }

      knownIds.current.add(notification.id);
      try {
        await new NotificationRepository(database).save(notification);
      } catch (saveError: unknown) {
        knownIds.current.delete(notification.id);
        throw saveError;
      }

      setNotifications((current) =>
        filterAndSortEventNotifications([
          notification,
          ...current.filter((saved) => saved.id !== notification.id),
        ]),
      );
      setBanner(notification);
      setError(null);
    },
    [database],
  );

  const receiveNotificationData = useCallback(
    async (data: unknown) => {
      const notification = acceptIncomingEventNotification(data, isOnline);
      if (notification) {
        await storeNotification(notification);
      }
    },
    [isOnline, storeNotification],
  );

  useEffect(() => {
    let active = true;
    const repository = new NotificationRepository(database);

    void repository
      .getLatest()
      .then((savedNotifications) => {
        if (active) {
          savedNotifications.forEach((notification) => knownIds.current.add(notification.id));
          setNotifications((current) =>
            filterAndSortEventNotifications([
              ...savedNotifications,
              ...current.filter(
                (notification) =>
                  !savedNotifications.some((saved) => saved.id === notification.id),
              ),
            ]),
          );
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
          setPermissionState(
            status === 'granted' ? 'granted' : status === 'denied' ? 'denied' : 'unknown',
          );
        }
      })
      .catch((permissionError: unknown) => {
        if (active) {
          setError(errorMessage(permissionError, 'No se pudo consultar el permiso de notificaciones.'));
        }
      });

    const receivedSubscription = Notifications.addNotificationReceivedListener((notification) => {
      void receiveNotificationData(notification.request.content.data).catch(
        (receiveError: unknown) => {
          setError(errorMessage(receiveError, 'No se pudo guardar el aviso recibido.'));
        },
      );
    });
    const responseSubscription = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        void receiveNotificationData(response.notification.request.content.data).catch(
          (receiveError: unknown) => {
            setError(errorMessage(receiveError, 'No se pudo guardar el aviso abierto.'));
          },
        );
      },
    );

    void Notifications.getLastNotificationResponseAsync()
      .then((response) => {
        if (response) {
          return receiveNotificationData(response.notification.request.content.data);
        }
        return undefined;
      })
      .catch((receiveError: unknown) => {
        if (active) {
          setError(errorMessage(receiveError, 'No se pudo recuperar el aviso abierto.'));
        }
      });

    return () => {
      active = false;
      receivedSubscription.remove();
      responseSubscription.remove();
    };
  }, [database, receiveNotificationData]);

  const requestPermission = useCallback(async () => {
    if (Platform.OS === 'web') {
      setPermissionState('unavailable');
      return false;
    }

    try {
      const current = await Notifications.getPermissionsAsync();
      const result =
        current.status === 'granted' ? current : await Notifications.requestPermissionsAsync();
      const granted = result.status === 'granted';
      setPermissionState(granted ? 'granted' : 'denied');
      setError(null);
      return granted;
    } catch (permissionError: unknown) {
      setPermissionState('unknown');
      setError(errorMessage(permissionError, 'No se pudo activar el permiso de notificaciones.'));
      return false;
    }
  }, []);

  const openSettings = useCallback(async () => {
    try {
      await Linking.openSettings();
    } catch (settingsError: unknown) {
      setError(errorMessage(settingsError, 'No se pudieron abrir los ajustes del sistema.'));
    }
  }, []);

  const markRead = useCallback(
    async (id: string) => {
      try {
        await new NotificationRepository(database).markRead(id);
        setNotifications((current) =>
          current.map((notification) =>
            notification.id === id ? { ...notification, is_read: true } : notification,
          ),
        );
        setError(null);
      } catch (markError: unknown) {
        setError(errorMessage(markError, 'No se pudo marcar el aviso como leído.'));
      }
    },
    [database],
  );

  const markAllRead = useCallback(async () => {
    try {
      await new NotificationRepository(database).markAllRead();
      setNotifications((current) =>
        current.map((notification) => ({ ...notification, is_read: true })),
      );
      setError(null);
    } catch (markError: unknown) {
      setError(errorMessage(markError, 'No se pudieron marcar los avisos como leídos.'));
    }
  }, [database]);

  const simulateNotification = useCallback(
    async (type: EventNotificationType, relatedZoneId?: string | null) => {
      if (!__DEV__ || !isOnline) {
        return false;
      }

      const notification = createDemoEventNotification(
        type,
        {
          id: createUuidV4(),
          received_at: new Date().toISOString(),
          related_zone_id: relatedZoneId,
        },
        isOnline,
      );
      if (!notification) {
        return false;
      }

      try {
        await storeNotification(notification);
        if (permissionState === 'granted' && Platform.OS !== 'web') {
          await Notifications.scheduleNotificationAsync({
            content: {
              title: notification.title,
              body: notification.content,
              data: { ...notification },
            },
            trigger: null,
          });
        }
        return true;
      } catch (simulationError: unknown) {
        setError(errorMessage(simulationError, 'No se pudo simular el aviso.'));
        return false;
      }
    },
    [isOnline, permissionState, storeNotification],
  );

  const unreadCount = useMemo(
    () => notifications.reduce((count, notification) => count + (notification.is_read ? 0 : 1), 0),
    [notifications],
  );
  const contextValue = useMemo<NotificationContextValue>(
    () => ({
      notifications,
      unreadCount,
      banner,
      permissionState,
      isOnline,
      canSimulate: __DEV__ && isOnline,
      error,
      requestPermission,
      openSettings,
      dismissBanner: () => setBanner(null),
      markRead,
      markAllRead,
      simulateNotification,
    }),
    [
      notifications,
      unreadCount,
      banner,
      permissionState,
      isOnline,
      error,
      requestPermission,
      openSettings,
      markRead,
      markAllRead,
      simulateNotification,
    ],
  );

  return (
    <NotificationContext.Provider value={contextValue}>
      {children}
      {banner ? (
        <View pointerEvents="box-none" style={styles.bannerContainer}>
          <View accessibilityLiveRegion="polite" style={styles.banner}>
            <View style={styles.bannerCopy}>
              <Text style={styles.bannerTitle}>{banner.title}</Text>
              <Text numberOfLines={2} style={styles.bannerMessage}>{banner.content}</Text>
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

function createUuidV4(): string {
  const cryptoApi = (globalThis as {
    crypto?: { randomUUID?: () => string };
  }).crypto;
  if (cryptoApi?.randomUUID) {
    return cryptoApi.randomUUID();
  }

  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (character) => {
    const randomValue = Math.floor(Math.random() * 16);
    const value = character === 'x' ? randomValue : (randomValue & 0x3) | 0x8;
    return value.toString(16);
  });
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
