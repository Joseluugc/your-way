# CLAUDE.md

Guía para Claude Code en este repositorio. Visión general del producto en [`README.md`](README.md); reglas del equipo en [`constitution.md`](constitution.md).

## Proyecto

**Your Way**: app móvil offline-first de gestión de eventos con pulseras NFC (asignatura ISM). Todo el código vive en `app-eventos/` (Expo 58, React Native 0.88, Expo Router, TypeScript estricto). Backend: Supabase.

Antes de tocar APIs de Expo/React Native, sigue [`app-eventos/AGENTS.md`](app-eventos/AGENTS.md): consulta la documentación versionada de Expo y no te fíes de la memoria.

## Comandos (desde `app-eventos/`)

```bash
npm start                # Expo dev server
npm run lint             # ESLint (expo lint)
npx tsc --noEmit         # typecheck
npm run test:domain      # tests de dominio (node:test, tests/*.test.mjs)
npx expo install <pkg>   # SIEMPRE para añadir dependencias
```

Ejecuta lint, typecheck y tests antes de dar una tarea por terminada.

Requiere `app-eventos/.env.local` con `EXPO_PUBLIC_SUPABASE_URL` y `EXPO_PUBLIC_SUPABASE_KEY` (ver `.env.example`); `src/lib/supabase.ts` lanza un error al importarse si faltan.

## Arquitectura

Hexagonal / DDD, flujo `app → screens → hooks → database | sync → domain`:

- `src/app/` — solo rutas (pestañas `index` = Resumen/dashboard, `mapa`). Reexportan pantallas de `src/screens/`.
- `src/domain/` — lógica pura, **sin imports de React Native ni Expo** (los tests la ejecutan con Node). Define puertos (`MapRepositoryPort`, `MapRemoteDataSource`…) que implementan `database/` y `sync/`.
- `src/database/` — esquema y migraciones locales en `initializeDatabase.ts` (`your-way-v2.db`), repositorios SQLite.
- `src/sync/` + `src/lib/supabase.ts` — adaptadores Supabase. `ensureSession()` inicia sesión anónima para que RLS (`authenticated`) permita escribir.
- `src/modules/gamification/` — (Spec 04, pendiente) módulo autocontenido con capas `domain` / `application` / `infrastructure` / `presentation`; solo se comunica con otros módulos por eventos (`src/shared/events/eventBus.ts`) y por `IRankingProjectionPort`.
- `src/providers/` — `SyncProvider` (sincroniza al montar y al recuperar conexión con `expo-network`) y `NotificationProvider`. Ambos dentro de `SQLiteProvider` en `_layout.tsx`.

## Sincronización offline-first

- Escribe siempre primero en SQLite y marca la fila como pendiente; nunca bloquees la UI esperando a la red.
- Subida: upsert por `id` de las filas pendientes; bajada incremental ordenada por `updated_at` con cursor en `local_sync_state`.
- `updated_at` remoto lo fija un trigger del servidor: no lo envíes en el upsert.
- Borrado lógico con `deleted_at` (no hay policy de DELETE en Supabase).
- `syncEventos` serializa ejecuciones (una a la vez, repite si se pidió otra mientras corría).
- Ojo: `eventos.sync_status` usa `'pending' | 'synced'` y `stands.sync_status` usa `'PENDING' | 'SYNCED'`.

## Base de datos

- Cambios de esquema local: añádelos en `initializeDatabase.ts` como migración idempotente (las instalaciones existentes ya tienen la BD creada).
- Cambios de esquema remoto: nuevo fichero numerado en `supabase/migrations/`; `schema.sql` es el esquema base.

## Convenciones

- TypeScript `strict`, sin `any`. Código, comentarios, commits y UI en español.
- Commits: descripción en infinitivo + referencia a la historia, p. ej. `implementar X [US-03.5]`.
- Ramas por persona/feature; a `main` solo por Pull Request.
- Especificaciones en `specs/` (01, 03, 07 implementadas o en desarrollo; 05 B2B/NFC pendiente; 04 gamificación pendiente). Skills de Spec Kit en `.github/skills/` (enlazadas desde `app-eventos/.claude/skills`).
- El NFC requiere dispositivo físico y development build; `react-native-nfc-manager` todavía no está instalado.
