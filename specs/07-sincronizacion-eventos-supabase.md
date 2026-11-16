# Spec 07: Sincronización de Eventos con Supabase

**Owner:** @joseluu.gc
**Rama:** `Joselu`
**Estado:** 📝 Borrador
**Depende de:** Spec 01 (arquitectura base y SQLite local)
**Fecha:** 2026-11-16
**Objetivo:** Sincronizar la tabla `eventos` entre SQLite y Supabase en ambos sentidos, sin perder el funcionamiento sin conexión.

## 1. Descripción Funcional

SQLite sigue siendo la única fuente de lectura de la app. Supabase es la copia central compartida entre dispositivos.

Cada evento creado o borrado en el móvil queda marcado como pendiente y se sube cuando hay red. Al abrir la app o al recuperar la conexión, se descargan los eventos que han cambiado en Supabase desde la última sincronización.

Los borrados son lógicos (`deleted_at`) para que también lleguen a los demás dispositivos. La app inicia una sesión anónima de Supabase sin intervención del usuario, y RLS solo permite escribir a usuarios autenticados.

Este spec fija el patrón que aplicarán después el resto de tablas.

## 2. Alcance

**Incluido:**

- Columnas de sincronización en `eventos`, tanto en SQLite como en Supabase.
- Trigger en Supabase que asigna `updated_at` con la hora del servidor.
- RLS y reglas de acceso (policies) de la tabla `eventos`.
- Login anónimo de Supabase.
- Sistema de migraciones local con `PRAGMA user_version`.
- Subida de pendientes, bajada incremental y borrado lógico.
- Disparo de la sincronización al arrancar, al reconectar y tras crear o borrar.
- Indicador de "pendiente" por evento y hora de la última sincronización en el dashboard del organizador.

**Fuera de alcance (specs futuros):**

- RLS y reglas de acceso de las otras 8 tablas (`users`, `stands`, `zones`, `nfc_tags`, `stamps`, `ratings`, `leads`, `access_logs`).
- Sincronización de esas 8 tablas.
- Login real (email u otro) y permisos por rol (STAFF, EXHIBITOR…).
- Edición de eventos (hoy solo se crean y se borran).
- Borrado físico de los eventos marcados como borrados.
- Tiempo real (Supabase Realtime) y sincronización en segundo plano con la app cerrada.

## 3. Modelo de Datos

**SQLite (`eventos`, migración 1 con `PRAGMA user_version`):**

```sql
ALTER TABLE eventos ADD COLUMN updated_at TEXT;          -- ISO 8601. Se rellena con UPDATE tras añadirla
ALTER TABLE eventos ADD COLUMN deleted_at TEXT;          -- NULL = activo
ALTER TABLE eventos ADD COLUMN sync_status TEXT NOT NULL DEFAULT 'pending'
  CHECK (sync_status IN ('pending', 'synced'));
```

- El cursor de bajada se guarda en la tabla `local_sync_state`, que ya existe, con `scope = 'eventos'`. En `last_synced_at` se guarda el `updated_at` más alto **del servidor** recibido, nunca la hora del móvil.
- El tipo `Evento` de `eventQueries.ts` añade `updated_at`, `deleted_at` y `sync_status`.

**Supabase (`supabase/migrations/0001_eventos_sync.sql`, que también se refleja en `schema.sql`):**

```sql
ALTER TABLE eventos ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE eventos ADD COLUMN deleted_at TIMESTAMPTZ;
CREATE INDEX idx_eventos_updated_at ON eventos(updated_at);
-- Trigger BEFORE INSERT OR UPDATE: NEW.updated_at = now()
ALTER TABLE eventos ENABLE ROW LEVEL SECURITY;
-- Policies para el rol authenticated: SELECT, INSERT y UPDATE. Sin policy de DELETE.
```

**Regla de conflicto:** gana la última escritura según el orden de llegada al servidor. Al bajar cambios, una fila que en el móvil está `pending` no se sobrescribe; se sube en la siguiente subida.

## 4. Plan de Implementación

1. **SQL remoto.** Crear `supabase/migrations/0001_eventos_sync.sql` y actualizar `schema.sql`. Ejecutarlo en el SQL Editor y activar "Allow anonymous sign-ins" en Authentication. Comprobación manual: con solo la clave pública, un INSERT por REST devuelve 401/403.
2. **Migraciones locales.** En `app-eventos/src/database/initializeDatabase.ts`, añadir un ejecutor de migraciones con `PRAGMA user_version` y la migración 1. Las filas que ya existen quedan `pending` con `updated_at` igual a la hora actual. Cambiar los IDs del seed `evento-1` y `evento-2` por UUID fijos. La app arranca y conserva los eventos que ya había.
3. **Consultas locales.** En `app-eventos/src/database/eventQueries.ts`:
   - `insertEvent` guarda la fila con `pending` y `updated_at`.
   - `deleteEvent` pasa a borrado lógico: rellena `deleted_at` y marca la fila `pending`.
   - `getEventos` filtra `deleted_at IS NULL`.
   - Nuevas funciones: `getPendingEventos`, `markEventoSynced(id, updated_at)` (solo si la fila no ha cambiado desde que se leyó) y `applyRemoteEventos(rows)`.
4. **Regla de fusión pura.** Crear `app-eventos/src/domain/sync/` con la función que decide si una fila remota se aplica o se ignora según el estado local. Probarla en `app-eventos/tests/eventosSync.test.mjs` con `npm run test:domain`.
5. **Sesión anónima.** En `app-eventos/src/lib/supabase.ts`, añadir `ensureSession()`: usa la sesión guardada o, si no hay, llama a `signInAnonymously()`.
6. **Motor de sincronización.** Crear `app-eventos/src/sync/eventosSync.ts` con `syncEventos(db)`: primero `ensureSession`, luego la subida (upsert por `id`) y por último la bajada (`updated_at > cursor`, ordenada). Solo puede haber una ejecución a la vez: si se pide otra mientras corre, se repite al terminar.
7. **Disparadores.** Crear `app-eventos/src/providers/SyncProvider.tsx` y montarlo en `app-eventos/src/app/_layout.tsx`, dentro de `SQLiteProvider`.
   - Sincroniza al montar y cuando `useNetworkState` (de `expo-network`, ya usado en `useMapData.ts`) pasa a conectado.
   - Expone `requestSync()` y la hora de la última sincronización.
   - `useEventos.remove` y el guardado de `CreateEventScreen.tsx` llaman a `requestSync()`.
8. **Interfaz.** En `app-eventos/src/screens/OrganizerDashboardScreen.tsx`, mostrar la etiqueta "Pendiente de sincronizar" en los eventos con `sync_status = 'pending'` y el texto "Última sincronización: HH:MM".

## 5. Historias de Usuario

### [US-07.1] Mis eventos llegan a la copia central
- **Como** organizador
- **Quiero** que los eventos que creo o borro sin conexión se suban solos cuando vuelva la red
- **Para** no perder cambios ni tener que repetirlos

**Criterios de Aceptación (Definition of Done):**
- [ ] Un evento creado sin conexión aparece en el dashboard con la etiqueta "Pendiente de sincronizar".
- [ ] Al recuperar la red, ese evento aparece en la tabla `eventos` de Supabase con el mismo `id`, y la etiqueta desaparece sin reiniciar la app.
- [ ] Un evento borrado en el móvil desaparece de la lista local y, tras sincronizar, tiene `deleted_at` relleno en Supabase. La fila no se elimina.
- [ ] Si se sincroniza dos veces seguidas, no se duplica ninguna fila en Supabase.

### [US-07.2] Recibir los eventos de otros dispositivos
- **Como** organizador con varios dispositivos
- **Quiero** que al abrir la app con red se descarguen los eventos nuevos o borrados en Supabase
- **Para** ver la misma agenda en todos ellos

**Criterios de Aceptación (Definition of Done):**
- [ ] Un evento insertado en Supabase aparece en la lista local tras abrir la app con red.
- [ ] Un evento con `deleted_at` relleno en Supabase desaparece de la lista local tras sincronizar.
- [ ] Un evento local pendiente no se sobrescribe con la versión remota antes de haberse subido.
- [ ] Se muestra "Última sincronización: HH:MM", que se actualiza tras cada sincronización correcta.

### [US-07.3] Funcionar sin conexión y con seguridad
- **Como** responsable del proyecto
- **Quiero** que la app siga funcionando sin red y que Supabase rechace escrituras anónimas sin sesión
- **Para** proteger los datos sin romper el modo offline

**Criterios de Aceptación (Definition of Done):**
- [ ] Sin red, la app arranca, lista los eventos y permite crear y borrar sin mostrar errores bloqueantes.
- [ ] Un fallo de red o de Supabase durante la sincronización deja los eventos en `pending` y no pierde datos.
- [ ] Un INSERT por REST usando solo la clave pública, sin sesión, es rechazado.
- [ ] En un móvil que ya tenía la base `your-way-v2.db`, los eventos que había se conservan tras la migración y quedan `pending`.
- [ ] `npm run test:domain`, `npx tsc --noEmit` y `npx expo lint` pasan.

## 6. Decisiones Tomadas y Descartadas

- **Sí:** solo `eventos` en este spec. Sirve para validar el patrón con una tabla que ya tiene interfaz.
- **No:** RLS de las 8 tablas restantes en este spec. Va en un spec de seguridad propio.
- **Sí:** login anónimo de Supabase. Permite que RLS distinga `authenticated` sin pantalla de login.
- **No:** escritura abierta con la clave pública. Cualquiera con la clave podría escribir y borrar.
- **No:** login con email y roles. Necesita su propio spec.
- **Sí:** borrado lógico (`deleted_at`). El borrado se propaga como un cambio más.
- **No:** DELETE físico ni cola de borrados. Los demás dispositivos no se enterarían.
- **Sí:** `updated_at` asignado por un trigger con la hora del servidor y usado como cursor. Evita perder cambios por relojes de móviles desfasados o por subidas tardías.
- **Sí:** la fila local pendiente gana hasta que se sube. Es la regla de conflicto más simple; los eventos no se editan.
- **Sí:** `PRAGMA user_version` para migrar SQLite. Conserva los datos locales y sirve para futuras migraciones.
- **No:** renombrar la base a `your-way-v3.db`. Se perderían los pendientes.
- **Sí:** SQL versionado en `supabase/migrations/` y ejecutado en el SQL Editor. No requiere instalar nada.
- **No:** Supabase CLI por ahora.
- **Sí:** UUID fijos en el seed. Los IDs `evento-1` y `evento-2` no son UUID válidos para Postgres.
- **Sí:** reutilizar `useNetworkState` de `expo-network`, la tabla `local_sync_state` y `generateEventId()`, que ya existen.

## 7. Riesgos Identificados

| Riesgo | Mitigación |
| --- | --- |
| Dos cambios en el servidor con el mismo `updated_at` y el cursor salta uno | `timestamptz` tiene precisión de microsegundos. La aplicación de filas remotas es idempotente. |
| La fila cambia en el móvil mientras se está subiendo | `markEventoSynced` solo marca `synced` si `updated_at` no ha cambiado. Si cambió, sigue `pending`. |
| Abuso del login anónimo (cualquiera con la app puede escribir) | Se acepta temporalmente. Lo resuelve el spec de autenticación y roles. Se puede activar captcha en Supabase. |
| La bajada dispara el listener de cambios y provoca bucles de sincronización | La sincronización se lanza solo con disparadores explícitos, nunca desde `addDatabaseChangeListener`. |

## Lo que **no** incluye este spec

- RLS y sincronización de `users`, `stands`, `zones`, `nfc_tags`, `stamps`, `ratings`, `leads` y `access_logs`.
- Login real y permisos por rol.
- Edición de eventos, purga física de borrados, Realtime y sincronización en segundo plano.

Cada uno de estos puntos, cuando llegue, irá en su propio spec.
