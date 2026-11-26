# Base de datos central (Supabase)

Base PostgreSQL alojada en Supabase. Es la copia compartida entre dispositivos; la app lee siempre de su SQLite local (ver Spec 07 y Spec 06).

## Orden de ejecución

Ejecutar en el **SQL Editor** de Supabase, en este orden:

| Paso | Fichero | Qué hace |
| --- | --- | --- |
| 1 | `migrations/0001_eventos_sync.sql` | Sincronización de `eventos` (Spec 07) |
| 2 | `migrations/0002_gamification.sql` | Tablas de gamificación (Spec 04) |
| 3 | `migrations/0003_core_audit.sql` | UUID, auditoría (`created_at`, `updated_at`, `deleted_at`), trigger de `updated_at`, índices y RLS de las 8 tablas principales (Spec 06) |
| 4 | `seed.sql` | Datos de la demo en vivo (Spec 06) |

- `../schema.sql` es el esquema base completo, equivalente a aplicar las migraciones. Un cambio de esquema nuevo va en un fichero numerado nuevo (`0004_…`); nunca se edita una migración ya aplicada.
- `seed.sql` es idempotente: usa UUID fijos e `INSERT … ON CONFLICT (id) DO NOTHING`, así que se puede ejecutar varias veces sin duplicar filas.
- En modo desarrollo, la app carga los mismos datos con los mismos UUID (`app-eventos/src/database/demoSeedData.ts`). El test `app-eventos/tests/demoSeed.test.mjs` falla si `seed.sql` y ese fichero divergen.

## Datos de la demo

- 1 evento: *Presentación Your Way* (`00000000-0000-4000-8000-000000000001`).
- 10 usuarios: 5 `ATTENDEE`, 2 `VIP`, 2 `STAFF`, 1 `EXHIBITOR`.
- 3 zonas: *Pabellón General* (300 personas, `ATTENDEE`), *Zona VIP & Lounge* (50, `VIP`) y *Backstage Staff* (20, `STAFF`).
- 4 estands en el plano (coordenadas de 0 a 100).
- 17 etiquetas NFC, listadas abajo.

## UIDs NFC asignados

Grabar estos UIDs en las etiquetas físicas antes de la demo.

### Pulseras (`USER_WRISTBAND`)

| UID | Usuario | Rol | UUID del usuario |
| --- | --- | --- | --- |
| `04:A1:00:00:00:01` | Ana Gómez | ATTENDEE | `d1000000-0000-4000-8000-000000000001` |
| `04:A1:00:00:00:02` | Luis Martín | ATTENDEE | `d1000000-0000-4000-8000-000000000002` |
| `04:A1:00:00:00:03` | Lucía Fernández | ATTENDEE | `d1000000-0000-4000-8000-000000000003` |
| `04:A1:00:00:00:04` | Pablo Ruiz | ATTENDEE | `d1000000-0000-4000-8000-000000000004` |
| `04:A1:00:00:00:05` | Sara Molina | ATTENDEE | `d1000000-0000-4000-8000-000000000005` |
| `04:A1:00:00:00:06` | María López | VIP | `d1000000-0000-4000-8000-000000000006` |
| `04:A1:00:00:00:07` | Javier Torres | VIP | `d1000000-0000-4000-8000-000000000007` |
| `04:A1:00:00:00:08` | Elena Navarro | STAFF | `d1000000-0000-4000-8000-000000000008` |
| `04:A1:00:00:00:09` | Diego Castro | STAFF | `d1000000-0000-4000-8000-000000000009` |
| `04:A1:00:00:00:0A` | Carlos Ruiz | EXHIBITOR | `d1000000-0000-4000-8000-000000000010` |

### Puntos de estand (`STAND_POINT`)

| UID | Estand | Zona | Coordenadas (x, y) | UUID del estand |
| --- | --- | --- | --- | --- |
| `04:B1:00:00:00:01` | Tech Solutions | Pabellón General | (20, 62) | `d3000000-0000-4000-8000-000000000001` |
| `04:B1:00:00:00:02` | AI & Data Lab | Pabellón General | (42, 74) | `d3000000-0000-4000-8000-000000000002` |
| `04:B1:00:00:00:03` | Rincón Sostenible | Pabellón General | (66, 60) | `d3000000-0000-4000-8000-000000000003` |
| `04:B1:00:00:00:04` | Lounge Partners | Zona VIP & Lounge | (84, 78) | `d3000000-0000-4000-8000-000000000004` |

### Controles de zona (`ZONE_CHECKPOINT`)

| UID | Zona | Aforo máximo | Rol requerido | UUID de la zona |
| --- | --- | --- | --- | --- |
| `04:C1:00:00:00:01` | Pabellón General | 300 | ATTENDEE | `d2000000-0000-4000-8000-000000000001` |
| `04:C1:00:00:00:02` | Zona VIP & Lounge | 50 | VIP | `d2000000-0000-4000-8000-000000000002` |
| `04:C1:00:00:00:03` | Backstage Staff | 20 | STAFF | `d2000000-0000-4000-8000-000000000003` |

Los UIDs son hexadecimales: la décima pulsera es `0A`, no `10`.
