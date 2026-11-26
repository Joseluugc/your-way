# Spec 08: Autenticación y Roles

**Owner:** @joseluu.gc
**Rama:** `Joselu`
**Issue:** TASK-17 (#26) · Prioridad Crítica · 2 puntos
**Estado:** 📝 Borrador
**Depende de:** Spec 07 (sincronización y sesión de Supabase), Spec 06 (base central, seed y RLS) y TASK-15 (IDs UUID en SQLite)
**Desbloquea:** TASK-18 (#27, AuthProvider y login), TASK-19 (#28, navegación por rol)
**Fecha:** 2026-11-26
**Objetivo:** Que organizadores y asistentes inicien sesión con email y contraseña en Supabase Auth, con un rol que solo asigna la organización y una sesión que sigue funcionando sin conexión.

## 1. Descripción Funcional

La app deja de usar la sesión anónima de la Spec 07. Para usarla hay que iniciar sesión con email y contraseña.

Cada cuenta de Supabase Auth tiene una fila en `users` con el mismo `id` (`users.id = auth.uid()`).

Quien se registra desde la app es siempre `ATTENDEE`. Solo un `STAFF` puede cambiar roles. `STAFF` es el rol de organizador (resuelve la duda de la Spec 01, US-01.3).

El perfil activo (id, nombre, email, rol) se guarda en el dispositivo. La app arranca con él sin red.

Cada rol ve solo sus pestañas. La autorización real la impone RLS en Supabase; ocultar pestañas es solo UX.

Para probar la app hay dos cuentas demo vinculadas al mismo evento por su código: Elena (STAFF) y Ana (ATTENDEE).

## 2. Alcance

**Incluido:**

- Login, registro y logout con email y contraseña (Supabase Auth).
- Eliminación de `signInAnonymously()` y adaptación de `ensureSession()`.
- Trigger que crea la fila de `users` al registrarse, siempre como `ATTENDEE`.
- RLS por rol de `users` y `evento_miembros`; nadie cambia su propio rol.
- Columna `eventos.codigo` y tabla `evento_miembros` en Supabase.
- Cuentas demo de Elena y Ana, miembros del evento demo con código `YWDEMO`.
- Perfil activo guardado en el dispositivo y comportamiento con token caducado sin red.
- Accesos rápidos de desarrollo (`__DEV__`) para Elena y Ana.
- Redirección a `login` sin sesión y pestañas por rol con rutas protegidas.

**Fuera de alcance (specs futuros):**

- Pantalla para unirse a un evento con código o QR, y generación del código al crear un evento.
- RLS por rol del resto de tablas (`eventos`, `zones`, `stands`, `nfc_tags`, `stamps`, `ratings`, `leads`, `access_logs`).
- Pantalla para que STAFF cambie roles desde la app (de momento, desde el panel de Supabase).
- Sincronización de `evento_miembros` y de la tabla `users` completa a SQLite.
- Recuperación de contraseña, confirmación por email, login social y multi-organización.
- Pestaña de Leads del EXHIBITOR (Sprint 3) y escritura NFC de pulseras (Spec 02).

## 3. Modelo de Datos

**Supabase (`supabase/migrations/0004_auth_roles.sql`, reflejado en `schema.sql`):**

```sql
ALTER TABLE eventos ADD COLUMN codigo VARCHAR(12) UNIQUE;   -- NULL = sin código

CREATE TABLE evento_miembros (
  evento_id  UUID NOT NULL REFERENCES eventos(id),
  user_id    UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),   -- trigger de servidor, como Spec 06
  deleted_at TIMESTAMPTZ,
  PRIMARY KEY (evento_id, user_id)
);

-- is_staff(): SECURITY DEFINER, devuelve si auth.uid() tiene role = 'STAFF' y deleted_at IS NULL.
-- handle_new_user(): trigger AFTER INSERT ON auth.users. Inserta en users (id, name, email, role = 'ATTENDEE');
--   name sale de raw_user_meta_data->>'name'. ON CONFLICT (id) DO NOTHING (las cuentas demo ya existen en el seed).
-- proteger_role(): trigger BEFORE UPDATE ON users. Rechaza el cambio de role si NOT is_staff().
```

Policies (sustituyen a las de `users` de `0003_core_audit.sql`):

- `users`: SELECT para `authenticated` (sin cambios); UPDATE solo de la propia fila o si `is_staff()`; sin INSERT desde el cliente (lo hace el trigger); sin DELETE.
- `evento_miembros`: SELECT de las filas propias (`user_id = auth.uid()`) o si `is_staff()`; INSERT y UPDATE solo si `is_staff()`; sin DELETE.

**Seed:**

- `supabase/seed.sql`: el evento demo `00000000-0000-4000-8000-000000000001` recibe `codigo = 'YWDEMO'`. Elena (`d1000000-0000-4000-8000-000000000008`, STAFF) y Ana (`d1000000-0000-4000-8000-000000000001`, ATTENDEE) son miembros.
- `supabase/seed_auth.sql` (nuevo, solo para el proyecto de desarrollo): crea en `auth.users` y `auth.identities` las cuentas de Elena y Ana con los mismos UUID, `email_confirmed_at = now()` y la contraseña de demo. Se ejecuta en el SQL Editor después de `seed.sql`.

**Dispositivo:**

- Perfil activo en `localStorage` de `expo-sqlite` (ya usado por `src/lib/supabase.ts`), clave `yourway:perfil`:

  ```ts
  type PerfilActivo = {
    id: string;
    nombre: string;
    email: string;
    rol: 'ATTENDEE' | 'VIP' | 'STAFF' | 'EXHIBITOR';
  };
  ```

- La sesión de Supabase sigue en el mismo `localStorage` (`persistSession: true`).
- Sin cambios de esquema en SQLite. `evento_miembros` y `codigo` no se bajan al móvil en esta spec.

## 4. Plan de Implementación

1. **SQL remoto (TASK-18).** Crear `supabase/migrations/0004_auth_roles.sql` y actualizar `schema.sql`. En el panel: desactivar "Allow anonymous sign-ins" y "Confirm email". Comprobación: un ATTENDEE que hace `UPDATE users SET role = 'STAFF'` por REST recibe error.
2. **Seed y cuentas demo.** Añadir código y miembros en `supabase/seed.sql`; crear `supabase/seed_auth.sql`. Comprobación: login por REST con el email de Elena devuelve un token y su `users.role` es `STAFF`.
3. **Dominio.** Crear `app-eventos/src/domain/auth/` sin imports de React Native:
   - Tipos `Rol` y `PerfilActivo` y puerto `AuthRemotePort`.
   - Validación de credenciales (email y contraseña de al menos 6 caracteres).
   - `esStaff(rol)` y pestañas por rol.
   - Decisión ante un fallo de refresco: si es de red, mantener la sesión; si el token es inválido, cerrar sesión.
   - Tests en `app-eventos/tests/auth.test.mjs`.
4. **Adaptador.** Crear `app-eventos/src/sync/supabaseAuth.ts`, que implementa `AuthRemotePort`: `signInWithPassword`, `signUp` (con `name` en metadata), `signOut({ scope: 'local' })` y lectura de la propia fila de `users`.
5. **AuthProvider y login.**
   - Crear `app-eventos/src/providers/AuthProvider.tsx` (usuario, rol, estado `cargando | sin-sesion | con-sesion`, `login`, `register`, `logout`), montado en `_layout.tsx` dentro de `SQLiteProvider` y antes de `SyncProvider`.
   - Crear `src/app/login.tsx` y `src/screens/LoginScreen.tsx` con modo registro y, en `__DEV__`, los botones "Entrar como Elena (STAFF)" y "Entrar como Ana (ATTENDEE)".
   - El `_layout.tsx` raíz pasa a `Stack` con `Stack.Protected` (sin sesión solo `login`).
6. **Sesión sin anónimo.** En `src/lib/supabase.ts`, `ensureSession()` deja de llamar a `signInAnonymously()`. Si no hay sesión válida, la sincronización (`eventosSync.ts`, `supabaseMapDataSource.ts`) se omite sin error y las filas siguen `pending`. Con red, el `AuthProvider` relee la fila de `users` tras el login y al reconectar, y actualiza el rol guardado.
7. **Navegación por rol (TASK-19).**
   - Mover `index`, `mapa` y `nfc` a `src/app/(tabs)/` (las URLs no cambian).
   - En `(tabs)/_layout.tsx`, usar `Tabs.Protected` según el rol (verificar la API en la documentación de Expo 58).
   - STAFF: Resumen, Mapa, Puertas. ATTENDEE, VIP y EXHIBITOR: Pasaporte, Escáner, Mapa.
   - Las pantallas sin terminar usan `src/screens/ProximamenteScreen.tsx`. NFC sigue solo en `__DEV__`.

## 5. Historias de Usuario

### [US-08.1] Iniciar sesión y registrarme (TASK-18)
- **Como** organizador o asistente
- **Quiero** entrar con mi email y contraseña, o registrarme si no tengo cuenta
- **Para** usar la app con mi identidad y mi rol

**Criterios de Aceptación (Definition of Done):**
- [ ] Sin sesión, la app abre `login` y no deja entrar en ninguna otra ruta.
- [ ] Un registro nuevo crea en Supabase una fila de `users` con `id = auth.uid()` y `role = 'ATTENDEE'`.
- [ ] El formulario de registro no permite elegir rol.
- [ ] Email o contraseña incorrectos muestran "Email o contraseña incorrectos". Un email ya registrado muestra "Ese email ya está registrado".
- [ ] Intentar entrar sin red y sin sesión guardada muestra "Necesitas conexión para iniciar sesión".
- [ ] En `__DEV__` aparecen los botones de Elena y Ana y entran con un toque. En un build de producción no aparecen.
- [ ] Elena y Ana aparecen en `evento_miembros` del evento con `codigo = 'YWDEMO'`.

### [US-08.2] Mantener la sesión sin conexión (TASK-18)
- **Como** usuario en un recinto sin cobertura
- **Quiero** que la app recuerde mi sesión y mi rol
- **Para** seguir usándola aunque no haya red

**Criterios de Aceptación (Definition of Done):**
- [ ] Tras iniciar sesión una vez, la app arranca sin red con el mismo usuario y rol.
- [ ] Con el token caducado y sin red, la app sigue funcionando; las escrituras quedan `pending` y la sincronización se omite sin errores bloqueantes.
- [ ] Al volver la red, se renueva el token y se suben las filas `pending`.
- [ ] Si la renovación falla porque la sesión ya no es válida, la app vuelve a `login` con el aviso "Tu sesión ha caducado" y no borra las filas `pending`.
- [ ] `logout` vuelve a `login`, borra `yourway:perfil` y no borra las filas `pending`.

### [US-08.3] Roles asignados solo por la organización (TASK-18)
- **Como** organizador
- **Quiero** ser el único que asigna `VIP`, `STAFF` o `EXHIBITOR`
- **Para** que nadie se dé permisos que no le corresponden

**Criterios de Aceptación (Definition of Done):**
- [ ] Un ATTENDEE que cambia su propio `role` por REST recibe un error y la fila no cambia.
- [ ] Un STAFF puede cambiar el `role` de otro usuario.
- [ ] Tras un cambio de rol en Supabase, el usuario lo ve en la app al volver a abrirla con red.
- [ ] Un ATTENDEE solo lee sus propias filas de `evento_miembros`.
- [ ] Con "Allow anonymous sign-ins" desactivado, `signInAnonymously()` falla y la app ya no lo llama.

### [US-08.4] Ver solo las pantallas de mi rol (TASK-19)
- **Como** usuario con un rol
- **Quiero** ver solo las pestañas de mi perfil
- **Para** no encontrarme pantallas que no puedo usar

**Criterios de Aceptación (Definition of Done):**
- [ ] STAFF ve Resumen, Mapa y Puertas.
- [ ] ATTENDEE, VIP y EXHIBITOR ven Pasaporte, Escáner y Mapa.
- [ ] Un ATTENDEE que navega directamente a una ruta de STAFF no llega a ella.
- [ ] Las pestañas sin pantalla terminada muestran "Próximamente".
- [ ] `npm run test:domain`, `npx tsc --noEmit` y `npx expo lint` pasan.

## 6. Decisiones Tomadas y Descartadas

- **Sí:** email y contraseña. Todo ocurre dentro de la app, sin deep links ni correo.
- **No:** magic link u OTP. Necesitan correo y red en el momento de entrar.
- **Sí:** desactivar la confirmación por email. Simplifica la demo; el registro solo da rol ATTENDEE.
- **Sí:** eliminar la sesión anónima. Cierra el riesgo de abuso que aceptó la Spec 07. Las filas `pending` no dependen del usuario, así que se suben tras el login.
- **No:** convertir la cuenta anónima con `updateUser`. Añade estados y el caso del email ya existente sin aportar nada.
- **Sí:** `STAFF` es el rol de organizador. No se crea `ORGANIZER`.
- **Sí:** la fila de `users` la crea un trigger en el servidor con rol fijo `ATTENDEE`. El cliente no puede elegir rol.
- **Sí:** un trigger impide cambiar `role` si no se es STAFF. Una policy no puede comparar columnas antiguas y nuevas.
- **Sí:** RLS por rol solo en `users` y `evento_miembros`. El resto de tablas lo usan otros módulos y va en specs posteriores.
- **Sí:** `eventos.codigo` y `evento_miembros`. Un usuario puede pertenecer a varios eventos; prepara la futura unión por código o QR.
- **No:** `users.evento_id`. Limitaría cada usuario a un solo evento.
- **Sí:** el código solo existe en el seed (`YWDEMO`). Generarlo al crear eventos llega con la spec de unirse.
- **Sí:** cuentas demo reales (Elena y Ana del seed) con los mismos UUID. RLS y la sincronización funcionan igual que en producción.
- **No:** perfiles simulados solo en local. La sincronización no funcionaría con ellos.
- **Sí:** dos cuentas demo en lugar de las cuatro de la issue #27 (admin y usuario base). VIP y EXHIBITOR se prueban cambiando el rol desde el panel.
- **Sí:** perfil activo en `localStorage` de `expo-sqlite`. Ya está instalado y lo usa la sesión de Supabase.
- **Sí:** rutas protegidas de Expo Router (`Stack.Protected`, `Tabs.Protected`). Impiden abrir una ruta escribiendo su URL.

## 7. Riesgos Identificados

| Riesgo | Mitigación |
| --- | --- |
| El token caduca sin red y la app expulsa al usuario | La identidad offline sale de `yourway:perfil`, no de la validez del token. Solo se cierra sesión si Supabase rechaza la renovación. |
| Rol desactualizado sin red | Se acepta. Las pestañas son solo UX; RLS valida el rol real al sincronizar. Se relee al reconectar. |
| Un usuario cambia su rol llamando a la API | Trigger `proteger_role` en el servidor. Hay un criterio de aceptación que lo prueba. |
| La contraseña de demo está en el repositorio y da acceso STAFF | `seed_auth.sql` solo se ejecuta en el proyecto de desarrollo. Los botones solo existen en `__DEV__`. |
| Las filas `pending` de un usuario las sube el siguiente que inicia sesión en el mismo móvil | Se acepta. Las tablas sincronizadas no guardan autor; se revisará cuando tengan RLS por propietario. |
| Insertar a mano en `auth.users` cambia entre versiones de Supabase | `seed_auth.sql` documenta las columnas usadas. Si falla, las cuentas se crean en el panel y se ajustan los UUID del seed. |
| Mover rutas a `(tabs)/` rompe enlaces internos | Los grupos entre paréntesis no cambian las URLs. Se revisan los `router.push` existentes. |

## Lo que **no** incluye este spec

- Pantalla de unirse a un evento con código o QR, y generación del código.
- RLS por rol del resto de tablas y pantalla de gestión de roles.
- Sincronización de `evento_miembros` y `users` a SQLite.
- Recuperación de contraseña, confirmación por email, login social y multi-organización.

Cada uno de estos puntos, cuando llegue, irá en su propio spec.
