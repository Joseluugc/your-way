# Spec 02: Hardware NFC — Lectura, Escritura de Pulseras y Modo Offline

**Owner:** @Hugo2-2
**Rama:** `Hugo`
**Prioridad:** Alta
**Estado:** 🔵 To Do
**Depende de:** Spec 01 (arquitectura y modelo local), Spec 07 (patrón de sincronización)
**La consumen:** Spec 04 (sellos de estand), Spec 05 (leads B2B y control de accesos)
**Épica en GitHub Projects:** #Epic-02

## 1. Descripción Funcional

La pulsera NFC es el identificador único de cada asistente. Este módulo se encarga de todo lo relacionado con el hardware: comprobar que el móvil tiene NFC y que está activado, leer pulseras y puntos NFC, y grabar y vincular una pulsera a un asistente en la entrada del evento.

Lo que se lee se resuelve siempre contra la base de datos local (`nfc_tags`), sin preguntar al servidor. Así se sabe si el tag es la pulsera de un asistente, el punto NFC de un estand o el control de una zona, y se avisa al módulo correspondiente (gamificación, leads o accesos) mediante el bus de eventos. Este módulo no aplica reglas de negocio de esos módulos: solo identifica el tag y publica qué se ha escaneado.

Todo funciona sin conexión. Las vinculaciones de pulseras se guardan primero en SQLite y se suben a Supabase cuando vuelve la red, sin duplicar ni pisar vinculaciones hechas desde otro dispositivo.

## 2. Historias de Usuario (Tickets para el Sprint)

### [US-02.1] Preparar el lector NFC del dispositivo
- **Como** usuario de la app (asistente, expositor o staff)
- **Quiero** que la app compruebe si mi móvil puede leer NFC y me guíe si no está listo
- **Para** saber antes de escanear si voy a poder usar las pulseras y los puntos NFC

**Criterios de Aceptación (Definition of Done):**
- [ ] Al abrir una pantalla de escaneo, la app distingue tres estados: **NFC no soportado**, **NFC desactivado** y **NFC listo**.
- [ ] Si el NFC no está soportado (o se ejecuta en emulador, web o Expo Go), se muestra un mensaje claro y se ocultan o desactivan los botones de escaneo; el resto de la app sigue funcionando.
- [ ] Si el NFC está desactivado en Android, se ofrece un botón para abrir los ajustes de NFC del sistema; al volver a la app el estado se vuelve a comprobar sin reiniciarla.
- [ ] En iOS, el escaneo se inicia siempre por una acción explícita del usuario (botón) y se muestra el texto de la hoja del sistema en español indicando qué acercar.
- [ ] El lector se inicializa una sola vez y se libera al salir de la pantalla: nunca quedan dos sesiones de lectura abiertas a la vez.
- [ ] En modo desarrollo existe un simulador de escaneos que permite elegir un tag de `nfc_tags` sin hardware, y que sigue exactamente el mismo flujo que una lectura real.

### [US-02.2] Leer un tag NFC y resolverlo sin conexión
- **Como** asistente, expositor o staff
- **Quiero** acercar el móvil a una pulsera o a un punto NFC y que la app sepa al instante qué es
- **Para** sellar un estand, guardar un contacto o validar un acceso aunque no haya internet

**Criterios de Aceptación (Definition of Done):**
- [ ] La lectura obtiene el identificador del tag y lo normaliza (hexadecimal en mayúsculas, sin separadores). Si el tag lleva un registro NDEF de Your Way, se usa ese identificador cuando el UID físico no esté disponible.
- [ ] El identificador se busca en la tabla local `nfc_tags` y se clasifica por su `type`:
  - `USER_WRISTBAND` → se publica `WristbandScanned` con el `userId` vinculado (lo consume la Spec 05).
  - `STAND_POINT` → se publica `StandNfcScanned` con el `standId` y el asistente que escanea (lo consume la Spec 04, según su contrato).
  - `ZONE_CHECKPOINT` → se publica `ZoneCheckpointScanned` con el `zoneId` (lo consume la Spec 05).
- [ ] Un tag que no está en `nfc_tags`, o que está borrado (`deleted_at` no nulo), se muestra como **«Tag no reconocido»**, no publica ningún evento y no escribe nada.
- [ ] Un tag ilegible, retirado antes de tiempo o con datos corruptos muestra **«No se ha podido leer, vuelve a acercarlo»** y no cierra la pantalla de escaneo.
- [ ] Si el mismo tag se lee varias veces seguidas en menos de **2 segundos**, solo se procesa la primera lectura (antirrebote).
- [ ] Si no se detecta ningún tag en **30 segundos**, la sesión de lectura se cierra con un aviso y el usuario puede volver a intentarlo. El usuario puede cancelar el escaneo en cualquier momento.
- [ ] Desde que se detecta el tag hasta que se muestra el resultado y se publica la vibración pasan menos de **200 ms**, con o sin red.
- [ ] Cada resultado (éxito, no reconocido, error) se comunica con texto y vibración (`HapticFeedbackRequested`), no solo con color.

### [US-02.3] Grabar y vincular una pulsera a un asistente en la puerta
- **Como** staff de acreditación
- **Quiero** seleccionar a un asistente y acercar una pulsera nueva para vincularla
- **Para** que a partir de ese momento la pulsera le identifique en todo el evento

**Criterios de Aceptación (Definition of Done):**
- [ ] Solo un usuario con rol `STAFF` puede acceder a la pantalla de acreditación.
- [ ] El staff busca al asistente en la lista local (por nombre o email), lo selecciona y acerca la pulsera.
- [ ] La app graba en la pulsera un único registro NDEF con un identificador opaco de Your Way (nunca nombre, email, empresa ni otros datos personales) y lo vuelve a leer para comprobar que se grabó bien antes de darlo por bueno.
- [ ] Tras la verificación se crea o actualiza la fila de `nfc_tags` con `type = 'USER_WRISTBAND'` y el `user_id` del asistente, marcada como pendiente de sincronizar, y se publica `AttendeeWristbandWritten` (contrato de la Spec 04).
- [ ] Si la escritura o la verificación fallan, no se guarda nada en SQLite ni se publica ningún evento, y se pide volver a acercar la pulsera.
- [ ] Si la pulsera ya pertenece a otro asistente, se avisa con su nombre y no se revincula sin una confirmación explícita del staff.
- [ ] Si el asistente ya tenía otra pulsera (por ejemplo, porque la perdió), al vincular la nueva la anterior se marca como borrada (`deleted_at`) y deja de reconocerse.
- [ ] Una pulsera de tipo `STAND_POINT` o `ZONE_CHECKPOINT` nunca se puede reasignar como pulsera de asistente desde esta pantalla.

### [US-02.4] Usar el NFC sin conexión y sincronizar al volver la red
- **Como** staff o asistente en un recinto sin cobertura
- **Quiero** que leer y vincular pulseras funcione igual con o sin internet
- **Para** que la falta de red no detenga la entrada ni la actividad del evento

**Criterios de Aceptación (Definition of Done):**
- [ ] Ninguna lectura ni vinculación espera a la red: todo se resuelve y se escribe en SQLite y la UI responde de inmediato.
- [ ] Antes del evento, la app descarga y guarda en local la tabla `nfc_tags` y los `users` necesarios; tras reiniciar el móvil sin red siguen disponibles.
- [ ] Las vinculaciones hechas sin red quedan pendientes (`sync_status = 'pending'`) y la pantalla de acreditación muestra cuántas faltan por subir.
- [ ] Al recuperar la conexión (`SyncProvider` + `expo-network`) se suben las vinculaciones pendientes con `upsert` por `uid` y se bajan los cambios remotos de `nfc_tags` de forma incremental por `updated_at`, usando el cursor de `local_sync_state`.
- [ ] Reintentar una subida no duplica filas ni eventos: sincronizar dos veces seguidas deja Supabase igual.
- [ ] Si al subir se detecta que la misma pulsera se vinculó sin red a **otro** asistente desde otro dispositivo, no se sobrescribe en silencio: la fila se marca como conflicto y se muestra al staff para que decida cuál es la correcta.
- [ ] Un fallo de red durante la sincronización deja las filas pendientes para el siguiente intento y no muestra errores bloqueantes.

## 3. Consideraciones Técnicas

- **Tablas implicadas:** `nfc_tags` (`uid`, `type`, `user_id`, `stand_id`, `zone_id`) y `users` (lectura). Las tablas `stamps`/`user_stamps`, `leads` y `access_logs` las escriben las Specs 04 y 05, no este módulo.
- **Cambios de esquema local:** migración idempotente en `initializeDatabase.ts` que añada a `nfc_tags` `updated_at`, `deleted_at`, `sync_status` (`'pending' | 'synced' | 'conflict'`) y un índice por `user_id`. Restricción de coherencia: cada `type` exige exactamente su clave (`USER_WRISTBAND` → `user_id`, `STAND_POINT` → `stand_id`, `ZONE_CHECKPOINT` → `zone_id`).
- **Cambios de esquema remoto:** nueva migración numerada en `supabase/migrations/` con las mismas columnas, trigger que fija `updated_at`, RLS para sesiones `authenticated` (insert/update, sin delete: borrado lógico) e índice único parcial «una pulsera activa por asistente» (`user_id` donde `type = 'USER_WRISTBAND'` y `deleted_at IS NULL`).
- **Identificador del tag:** se usa el UID físico como clave (`nfc_tags.uid`). En iOS el UID solo está disponible abriendo una sesión por tecnología (ISO 14443/MIFARE), no en una lectura NDEF simple; por eso la pulsera también lleva un registro NDEF de Your Way (`yourway:w:<uid>`) como respaldo. Hay que validar en dispositivos físicos iOS y Android qué tipo de pulsera (p. ej. NTAG213/215) se compra antes de cerrar este punto.
- **Privacidad:** la pulsera solo contiene un identificador opaco. Los datos del asistente se obtienen siempre de la base local; perder una pulsera no expone datos personales.
- **Arquitectura:**
  - `src/domain/nfc/` — lógica pura y testeable con `npm run test:domain`: normalizar UID, codificar/decodificar el registro NDEF, clasificar el tag, antirrebote y decidir qué evento publicar. Define el puerto `NfcReaderPort` (`isSupported`, `isEnabled`, `readTag`, `writeWristband`, `cancel`) y `NfcTagRepositoryPort`.
  - `src/nfc/` (infraestructura) — adaptador de `NfcReaderPort` sobre `react-native-nfc-manager` y adaptador simulado para desarrollo.
  - `src/database/` — `NfcTagRepository` sobre SQLite; `src/sync/` — adaptador Supabase de `nfc_tags`.
  - La comunicación con otros módulos es solo por eventos (`src/shared/events/eventBus.ts`).
- **Eventos publicados:** `StandNfcScanned` y `AttendeeWristbandWritten` (contrato ya fijado en `specs/004-gamification-passport/contracts/domain-events.md`), `WristbandScanned { v, scannerUserId, scannedUserId, tagUid, scannedAt }` y `ZoneCheckpointScanned { v, zoneId, tagUid, scannedAt }` para la Spec 05, y `HapticFeedbackRequested` para la vibración.
- **Tecnologías/Librerías:** `react-native-nfc-manager` instalado con `npx expo install` y su config plugin en `app.json` (permiso NFC en Android, `NFCReaderUsageDescription` y entitlement en iOS). Requiere **development build** y dispositivo físico: no funciona en Expo Go, emuladores ni web. Antes de implementar, consultar la documentación versionada de Expo (ver `app-eventos/AGENTS.md`).
- **Sincronización:** se sigue el patrón de la Spec 07: SQLite primero, `upsert` por `uid` de las filas pendientes sin enviar `updated_at`, bajada incremental con cursor en `local_sync_state` (scope `nfc_tags`) y ejecuciones serializadas.
- **Rendimiento:** menos de 200 ms entre la detección del tag y el feedback (mismo objetivo que la Spec 04); la vinculación completa (seleccionar asistente → grabar → verificar) en menos de 10 s.
- **Supuestos:** un móvil por asistente; los tags `STAND_POINT` y `ZONE_CHECKPOINT` los da de alta la organización antes del evento y se descargan con el resto de datos.
- **Fuera de alcance:** la UI para dar de alta tags de estands y zonas, el bloqueo permanente (solo lectura) de las pulseras, la emulación de tarjetas (HCE) y las reglas de negocio de sellos, leads y accesos (Specs 04 y 05).
