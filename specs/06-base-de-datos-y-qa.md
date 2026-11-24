# Spec 06: Base de Datos Central y QA

**Owner:** @Javi
**Rama:** `Javi`
**Issue:** TASK-13 (#13) · Prioridad Alta · 2 puntos
**Estado:** 🟡 En revisión (pendientes las comprobaciones manuales marcadas abajo)
**Épica en GitHub Projects:** #Epic-06
**Depende de:** Spec 01 (SQLite local), Spec 03 (mapa y aforo), Spec 07 (patrón de sincronización con Supabase)
**Desbloquea:** TASK-14 (despliegue de la base central y datos semilla)
**Fecha:** 2026-11-24

## 1. Descripción Funcional

La base central es **PostgreSQL alojado en Supabase**. Es la copia compartida entre dispositivos. SQLite (`expo-sqlite`) sigue siendo la fuente de lectura de la app.

Esta spec fija tres cosas:

1. **Cómo evoluciona el esquema central:** migraciones SQL numeradas, identificadores UUID v4 y campos de auditoría en las 8 tablas principales, para que puedan sincronizarse con el mismo patrón que `eventos` (Spec 07).
2. **Cómo se cargan los datos de demostración:** un `seed.sql` reproducible con usuarios de los 4 roles, zonas con aforo, estands y UIDs de etiquetas NFC para la demo en vivo.
3. **Cómo se comprueba la calidad:** suite automatizada (tests de dominio, componentes y sincronización), cobertura mínima trazable a las Historias de Usuario, y métricas de accesibilidad verificables (contraste WCAG AA, daltonismo, lector de pantalla y vibración).

### Alcance

**Incluido:**

- Migración `supabase/migrations/0003_core_audit.sql` con auditoría y RLS de las 8 tablas principales.
- `supabase/seed.sql` con los datos de la demo y su equivalente local en modo desarrollo.
- Infraestructura de Jest + React Native Testing Library junto a la suite `node:test` existente.
- Tests de las reglas críticas de negocio y de la cola de sincronización.
- Criterios de accesibilidad del semáforo de aforo y patrones de vibración para los resultados NFC.

**Fuera de alcance:**

- Sincronización de las 8 tablas (cada módulo la implementa con el patrón de Spec 07 usando los campos que añade esta spec).
- Lectura NFC real (`react-native-nfc-manager` aún no está instalado; Spec 05).
- Tablas de gamificación (`user_stamps`, `stand_ratings`, etc.), ya definidas en `0002_gamification.sql` por la Spec 04.
- Tests end-to-end en dispositivo (Detox/Maestro).

## 2. Historias de Usuario (Tickets para el Sprint)

### [US-06.1] Migraciones y datos semilla de la base central
- **Como** especialista en datos del equipo
- **Quiero** un esquema central versionado con UUID y campos de auditoría, y un script de datos semilla
- **Para** que cualquier miembro pueda recrear la base de la demo y que los datos creados offline se sincronicen sin colisiones ni conflictos sin resolver

**Criterios de Aceptación (Definition of Done):**
- [ ] Existe `supabase/migrations/0003_core_audit.sql` y se ejecuta sin errores en el SQL Editor de Supabase sobre una base con `0001` y `0002` aplicadas. *(Verificado sobre PostgreSQL 17 con PGlite; falta ejecutarlo en el Supabase del equipo.)*
- [x] Las 8 tablas principales (`users`, `nfc_tags`, `stands`, `zones`, `stamps`, `ratings`, `leads`, `access_logs`) tienen clave primaria UUID con valor por defecto `gen_random_uuid()` (v4). `nfc_tags` conserva `uid` (UID físico de la etiqueta) como clave natural `UNIQUE` y añade `id UUID` como clave primaria.
- [x] Las 8 tablas tienen `created_at TIMESTAMPTZ NOT NULL DEFAULT now()`, `updated_at TIMESTAMPTZ NOT NULL DEFAULT now()` y `deleted_at TIMESTAMPTZ` (NULL = activo).
- [x] Un trigger `BEFORE INSERT OR UPDATE` asigna `updated_at = now()` en las 8 tablas; un `updated_at` enviado por el cliente se ignora.
- [x] Cada tabla tiene un índice sobre `updated_at` (cursor de bajada incremental).
- [x] RLS activado en las 8 tablas, con policies `SELECT`, `INSERT` y `UPDATE` para `authenticated` y sin policy de `DELETE` (borrado lógico, como en Spec 07).
- [x] `schema.sql` refleja el esquema resultante.
- [x] Existe `supabase/seed.sql`, idempotente (`INSERT … ON CONFLICT (id) DO NOTHING`, UUID fijos), que carga al menos:
    - 10 usuarios: 5 `ATTENDEE`, 2 `VIP`, 2 `STAFF`, 1 `EXHIBITOR`;
    - 3 zonas con `max_capacity` y `required_role` (una general, una VIP y una STAFF);
    - 4 estands con coordenadas dentro del plano;
    - etiquetas NFC: una `USER_WRISTBAND` por usuario, una `STAND_POINT` por estand y una `ZONE_CHECKPOINT` por zona, con UIDs documentados en una tabla de la sección 3.
- [x] Ejecutar `seed.sql` dos veces seguidas no duplica filas.
- [x] La base local en modo desarrollo carga los mismos UUID que `seed.sql` (mediante una migración en `initializeDatabase.ts`), de modo que un dispositivo y Supabase identifican igual a cada usuario, zona y estand.
- [x] Un test con `sqliteHarness.mjs` comprueba que una base con la versión anterior de `user_version` migra sin perder filas.

### [US-06.2] Suite de pruebas automatizadas de QA
- **Como** miembro del equipo que integra en `main`
- **Quiero** una suite de pruebas automatizada que valide las reglas críticas de negocio y la sincronización
- **Para** detectar regresiones antes de cada Pull Request y poder trazar cada test a su Historia de Usuario

**Criterios de Aceptación (Definition of Done):**
- [x] Jest (preset `jest-expo`) y `@testing-library/react-native` se instalan con `npx expo install` y se ejecutan con `npm test`. La suite `npm run test:domain` (`node:test`) se mantiene.
- [x] **Control de acceso por rol y zona:** tests que cubren acceso permitido, acceso denegado por rol insuficiente y zona sin `required_role`, para los 4 roles.
- [x] **Aforo en tiempo real:** tests de `calculateZoneOccupancy` en los umbrales exactos (69,9 %, 70 %, 94,9 %, 95 %, 100 %), con zona sin capacidad válida (`unavailable`) y con más salidas que entradas.
- [x] **Sellos sin duplicados:** un segundo escaneo del mismo usuario en el mismo estand no crea otro sello, ni en SQLite ni al subirlo (restricción `UNIQUE (user_id, stand_id)`). *(La subida se prueba con un doble del remoto: el adaptador real de sellos llega con la Spec 04.)*
- [x] **Cola de sincronización offline → online:** tests que comprueban que una fila creada sin red queda `pending`; que tras una subida correcta pasa a `synced`; que un fallo de red la deja `pending`; que una fila remota no sobrescribe una local `pending`; y que repetir la sincronización no duplica filas.
- [x] **Componentes:** tests con React Native Testing Library de `CreateEventScreen` (validación de campos y de rango de fechas) y del semáforo de aforo (texto e icono por nivel).
- [x] Cada test lleva en su nombre la Historia de Usuario que valida, por ejemplo `[US-03.2] marca la zona como llena al 95 %`.
- [x] Cobertura mínima medida con `jest --coverage`: **≥ 80 % de líneas en `src/domain/`** y **≥ 60 % de líneas en el total del proyecto**. El umbral se configura en `coverageThreshold` para que la suite falle si no se alcanza.
- [x] `npm test`, `npm run test:domain`, `npx tsc --noEmit` y `npm run lint` pasan antes de cada Pull Request a `main`.

### [US-06.3] Validación de accesibilidad y feedback háptico
- **Como** asistente con baja visión, daltonismo o que usa lector de pantalla
- **Quiero** que el mapa y las lecturas NFC se entiendan sin depender del color ni de mirar la pantalla
- **Para** poder moverme por el evento y saber el resultado de cada lectura en igualdad de condiciones

**Criterios de Aceptación (Definition of Done):**
- [x] **Contraste:** todo texto alcanza una relación de contraste ≥ 4,5:1 con su fondo (WCAG 2.1 AA, criterio 1.4.3); el texto grande (≥ 18 pt, o ≥ 14 pt en negrita) y los iconos y bordes de controles alcanzan ≥ 3:1 (criterio 1.4.11). Se verifica con una función de dominio que calcula la relación de contraste de cada par de colores definidos en los estilos, con su test.
- [x] **Semáforo de aforo sin depender del color:** cada nivel (`available`, `medium`, `full`, `unavailable`) muestra, además del color, un icono distinto y un texto ("Disponible", "Ocupación media", "Completo", "Sin datos").
- [ ] **Daltonismo:** con la simulación de protanopía, deuteranopía y tritanopía (herramienta "Emulate vision deficiencies" de Chrome DevTools sobre la versión web), los 4 niveles del semáforo se distinguen entre sí por su icono y su texto. Se adjuntan las capturas a la Pull Request.
- [x] **Vibración diferenciada** con `expo-haptics`, mediante una función de dominio pura que asocia cada resultado a un patrón (verificando la API contra la documentación de Expo SDK 58):
    - lectura NFC correcta → notificación de éxito;
    - acceso denegado → notificación de error;
    - error de lectura → notificación de aviso.
- [x] La función de patrones está probada para los 3 resultados, y la vibración nunca es el único aviso: cada resultado también se muestra en pantalla y se anuncia al lector de pantalla.
- [x] **Lector de pantalla:** todo componente interactivo (botones, campos de fecha, estands y zonas del mapa, filas de eventos) tiene `accessibilityRole` y `accessibilityLabel` en español; las acciones no evidentes tienen `accessibilityHint` (por ejemplo, "mantén pulsado para eliminar").
- [x] Un test de React Native Testing Library recorre las pantallas `index`, `mapa` y el formulario de evento y falla si algún elemento pulsable carece de `accessibilityLabel`.
- [ ] Prueba manual con TalkBack (Android) o VoiceOver (iOS): crear un evento y consultar el aforo de una zona sin mirar la pantalla. El resultado se anota en la Pull Request.

## 3. Consideraciones Técnicas

### Tablas implicadas

| Tabla | Cambio en esta spec | Clave primaria | Notas |
| --- | --- | --- | --- |
| `users` | auditoría + RLS + seed | `id UUID` | ya tiene `created_at` |
| `nfc_tags` | auditoría + RLS + seed + `id UUID` | `id UUID` | `uid` pasa a `UNIQUE` |
| `stands` | auditoría + RLS + seed | `id UUID` | ya sincroniza en Spec 03 |
| `zones` | auditoría + RLS + seed | `id UUID` | `max_capacity`, `required_role` |
| `stamps` | auditoría + RLS | `id UUID` | `UNIQUE (user_id, stand_id)` |
| `ratings` | auditoría + RLS | `id UUID` | `score` entre 1 y 5 |
| `leads` | auditoría + RLS | `id UUID` | — |
| `access_logs` | auditoría + RLS | `id UUID` | base del cálculo de aforo |
| `eventos` | sin cambios | `id UUID` | patrón de referencia (Spec 07) |

### UIDs NFC de la demo

Los UIDs se fijan en `supabase/seed.sql` (fuente: `app-eventos/src/database/demoSeedData.ts`). La tabla completa, con cada usuario, estand y zona asignados, está en [`supabase/README.md`](../supabase/README.md).

| UID | Tipo | Cantidad | Asignado a |
| --- | --- | --- | --- |
| `04:A1:00:00:00:01` – `04:A1:00:00:00:0A` | `USER_WRISTBAND` | 10 | un usuario cada una |
| `04:B1:00:00:00:01` – `04:B1:00:00:00:04` | `STAND_POINT` | 4 | un estand cada una |
| `04:C1:00:00:00:01` – `04:C1:00:00:00:03` | `ZONE_CHECKPOINT` | 3 | una zona cada una |

### Tecnologías y librerías

- **Base central:** Supabase (PostgreSQL), RLS, `gen_random_uuid()`, triggers `plpgsql`.
- **Base local:** `expo-sqlite` con migraciones `PRAGMA user_version` en `initializeDatabase.ts`.
- **Tests:** `node:test` + `sqliteHarness.mjs` para dominio y repositorios (ya existentes); Jest con `jest-expo` y `@testing-library/react-native` para componentes y hooks.
- **Accesibilidad:** `expo-haptics` (instalar con `npx expo install`), props de accesibilidad de React Native, Chrome DevTools para la simulación de daltonismo.

### Métricas verificables

| Métrica | Umbral | Cómo se mide |
| --- | --- | --- |
| Cobertura de líneas en `src/domain/` | ≥ 80 % | `jest --coverage` (`coverageThreshold`) |
| Cobertura de líneas total | ≥ 60 % | `jest --coverage` |
| Contraste de texto normal | ≥ 4,5:1 | test de la función de contraste |
| Contraste de texto grande, iconos y bordes | ≥ 3:1 | test de la función de contraste |
| Niveles de aforo distinguibles sin color | 4 de 4 | test de componente + capturas con simulación de daltonismo |
| Elementos pulsables con `accessibilityLabel` | 100 % | test de recorrido de pantallas |
| Resultados NFC con patrón háptico propio | 3 de 3 | test de la función de patrones |
| Ejecuciones de `seed.sql` sin duplicados | 2 seguidas | comprobación manual en el SQL Editor |

### Manejo offline

- SQLite sigue siendo la fuente de lectura: los datos semilla también se cargan en local en modo desarrollo, así que la demo funciona sin red.
- Los campos `updated_at` y `deleted_at` permiten aplicar a las 8 tablas la regla de Spec 07: la fila local `pending` gana hasta que se sube; `updated_at` lo fija el servidor y sirve de cursor; los borrados son lógicos.
- Los tests de sincronización simulan la red con dobles de prueba: no dependen de Supabase ni de conexión.
- El feedback háptico y los avisos de accesibilidad no dependen de la red.

### Decisiones tomadas

- **Sí:** Supabase como PostgreSQL central (acordado en Spec 07), en lugar de un servidor Node.js propio.
- **Sí:** `expo-sqlite` en local. WatermelonDB no se usa: obligaría a reescribir los repositorios existentes y no funciona en Expo Go.
- **Sí:** mantener `node:test` para el dominio y añadir Jest solo donde hace falta React Native. Así se conservan los 47 tests actuales sin migrarlos.
- **Sí:** SQL versionado en `supabase/migrations/` ejecutado en el SQL Editor. Supabase CLI queda fuera por ahora.
- **No:** borrado físico ni policy de `DELETE`. Los borrados no llegarían a los demás dispositivos.

### Riesgos

| Riesgo | Mitigación |
| --- | --- |
| Añadir `id UUID` a `nfc_tags` rompe referencias que usan `uid` | La migración conserva `uid` como `UNIQUE`; las búsquedas por lectura NFC siguen usando `uid`. |
| `jest-expo` incompatible con la versión de Expo instalada | Instalar siempre con `npx expo install`, que elige la versión compatible con el SDK 58. |
| Los colores actuales no alcanzan 4,5:1 | El test de contraste lista los pares que fallan; se ajustan los tokens de color antes de cerrar la historia. |
| El seed local y el remoto divergen | Ambos usan los mismos UUID fijos, y un test compara los identificadores del seed local con los de `seed.sql`. |
