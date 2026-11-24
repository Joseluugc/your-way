# Spec 04: Gamificación, Pasaporte Digital y Valoración de Estands

**Owner:** @Samu
**Rama:** `Samu`
**Prioridad:** Alta
**Estado:** 🔵 To Do
**Depende de:** Spec 03 (estands, zonas y aforo), Spec 05 (lectura NFC y pulseras), Spec 07 (patrón de sincronización)
**Épica en GitHub Projects:** #Epic-04

## 1. Descripción Funcional

El asistente lleva en la app un pasaporte digital. Al acercar el móvil al tag NFC de un estand consigue su sello, responde una pregunta rápida sobre el expositor y lo valora de 1 a 5 estrellas. Cada acción da puntos de experiencia (XP).

Al recibir la pulsera en la puerta, cada asistente entra en una facción y todos sus puntos suman al marcador de su equipo. Para repartir mejor a la gente por el recinto, los estands de las zonas poco ocupadas (verde en el semáforo de la Spec 03) dan el doble de puntos. Además, cada 3 sellos el asistente gira una ruleta de premios y puede desbloquear insignias ocultas.

Todo funciona sin conexión: se guarda primero en SQLite y se sube a Supabase cuando vuelve la red, sin duplicar sellos ni puntos.

## 2. Historias de Usuario (Tickets para el Sprint)

### [US-04.1] Sellar un estand, responder la Micro-Trivia y valorarlo
- **Como** asistente
- **Quiero** escanear el NFC de un estand para conseguir su sello, responder una pregunta y valorarlo
- **Para** completar mi pasaporte y ganar puntos, aunque no haya internet en el recinto

**Criterios de Aceptación (Definition of Done):**
- [ ] El primer escaneo de un estand crea un sello único por asistente y estand (`UNIQUE(user_id, stand_id)`) y da **100 XP**.
- [ ] Después del sello se muestra una Micro-Trivia de 3 opciones con 15 segundos: si acierta, **+50 XP**; si falla o se acaba el tiempo, 0 XP extra, pero conserva el sello. La trivia solo se puede responder una vez.
- [ ] Si se cierra la app durante la trivia, al reabrirla cuenta como fallada (sin XP extra y sin poder repetirla). Si el estand no tiene trivia, se pasa directamente a la valoración.
- [ ] Después de la trivia se puede valorar el estand de 1 a 5 estrellas: **+25 XP** una sola vez. Se puede dejar para más tarde desde el pasaporte; una vez enviada no se puede cambiar.
- [ ] Si el estand ya estaba sellado, la app avisa de que ya lo visitó y muestra su valoración, sin dar puntos ni sellos de nuevo.
- [ ] Un tag que no corresponde a ningún estand del evento muestra un aviso y no da nada.
- [ ] Al conseguir el sello se publica el evento de vibración `STAMP_SUCCESS`.
- [ ] El pasaporte muestra los sellos conseguidos, los estands pendientes de valorar y el total de XP.

### [US-04.2] Batalla de facciones y Misiones Relámpago
- **Como** asistente
- **Quiero** pertenecer a una facción y ganar el doble en las zonas tranquilas
- **Para** competir con mi equipo y descubrir zonas menos llenas

**Criterios de Aceptación (Definition of Done):**
- [ ] Al grabar la pulsera en puerta, el asistente queda en una facción (reparto equilibrado entre las del evento).
- [ ] Todos los puntos que gana (sello, trivia, valoración, insignias y ruleta) suman también al total de su facción. Si aún no tiene facción, sus puntos se le suman en cuanto se le asigne.
- [ ] Si la zona del estand está en verde (ocupación < 70 %) en el momento del escaneo, el sello y la trivia valen **×2** (200 y 100 XP). Una zona sin dato de aforo nunca da bonus. Los multiplicadores nunca se aplican a la valoración, las insignias ni la ruleta.
- [ ] Cuando una zona pasa a verde se envía la notificación «Misión Relámpago», como mucho una vez cada **20 minutos** por zona.

### [US-04.3] Ruleta de recompensa cada 3 sellos
- **Como** asistente
- **Quiero** girar una ruleta cada vez que acumulo 3 sellos
- **Para** conseguir premios sorpresa y seguir visitando estands

**Criterios de Aceptación (Definition of Done):**
- [ ] Cada 3 sellos (configurable por evento) se habilita una tirada. Si no las gasta, las tiradas se acumulan.
- [ ] Premios por defecto: 40 % +200 XP, 30 % ×1.5 en el siguiente estand, 20 % boleto extra para el sorteo y 10 % premio físico canjeable. Los porcentajes se pueden configurar por evento y deben sumar 100 %; en 1 000 tiradas simuladas cada premio sale dentro de ±5 puntos de su porcentaje.
- [ ] El premio se guarda antes de la animación: cerrar la app no permite volver a tirar.
- [ ] El ×1.5 se aplica al sello y la trivia del siguiente estand nuevo y se gasta. Si coincide con el ×2 de zona, se multiplican (×3).
- [ ] Los premios físicos aparecen como pendientes de canje hasta que el staff los marca como entregados.
- [ ] Al ganar un premio se publica el evento de vibración `ROULETTE_WIN`.

### [US-04.4] Insignias ocultas
- **Como** asistente
- **Quiero** desbloquear insignias secretas al cumplir retos
- **Para** tener motivos extra para explorar el evento

**Criterios de Aceptación (Definition of Done):**
- [ ] Se calculan en el móvil, sin conexión, después de cada sello o valoración:
  - `EARLY_BIRD`: primer sello en los primeros 15 min desde el inicio del evento (**+150 XP**).
  - `EXPERT_CRITIC`: 5 estands distintos valorados (**+200 XP**).
  - `SECTOR_EXPLORER`: todos los estands de una misma zona sellados (**+300 XP**).
  - `SPEEDRUNNER`: 3 sellos seguidos de estands distintos con 5 minutos o menos entre el primero y el tercero (**+250 XP**).
- [ ] Cada insignia se consigue una sola vez y se muestra oculta («???») hasta desbloquearla.
- [ ] Al desbloquear una insignia se publica el evento de vibración `ACHIEVEMENT_UNLOCKED`.

### [US-04.5] Ranking de estands y marcador de facciones
- **Como** asistente u organizador
- **Quiero** ver los estands mejor valorados y los puntos de cada facción
- **Para** conocer los expositores más populares y qué equipo va ganando

**Criterios de Aceptación (Definition of Done):**
- [ ] Los estands se ordenan por media bayesiana `(v·R + 5·C) / (v + 5)` (v = nº de valoraciones, R = media del estand, C = media global), de modo que un único 5 ★ no gane a un estand con muchas valoraciones altas. En caso de empate, gana el que tenga más valoraciones y después por nombre.
- [ ] El marcador muestra el total de XP de cada facción, que es la suma de las transacciones de sus miembros.
- [ ] Sin conexión se muestran los últimos datos conocidos con su hora de actualización.
- [ ] El dashboard del organizador (Spec 01) puede leer el ranking a través de `IRankingProjectionPort`.

## 3. Consideraciones Técnicas

- **Tablas nuevas:** `factions`, `stand_trivia`, `user_stamps`, `stand_ratings`, `xp_transactions`, `user_achievements` y `roulette_spins`, con IDs UUID generados en el cliente. Además, `attendee_factions` (facción de cada asistente) y `gamification_config` (cada cuántos sellos hay tirada y porcentajes de la ruleta). `user_stamps` y `stand_ratings` sustituyen a `stamps` y `ratings`: la migración copia los datos existentes, sin dar XP retroactivo, y el dashboard pasa a leer las nuevas. Las tablas antiguas se conservan.
- **Libro mayor de puntos:** `xp_transactions` es append-only (solo inserciones; se guarda el XP base, el multiplicador y el XP final). El total de un asistente o de una facción siempre se calcula como suma; no hay contadores que se sobrescriban.
- **Estands y zonas:** hoy `stands` no tiene zona. Hay que añadir `stands.zone_id` para el ×2 y para `SECTOR_EXPLORER` (coordinar con Rafa).
- **Arquitectura:** módulo en `src/modules/gamification/` con capas `domain`, `application`, `infrastructure` y `presentation`. Las reglas (puntos, multiplicadores, insignias, ruleta, ranking) van en TS puro, sin React Native, para probarlas con `npm run test:domain`.
- **Comunicación con otros módulos (por eventos, sin imports directos):**
  - Entrada: `AttendeeWristbandWritten` y `StandNfcScanned` (NFC, Hugo), `ZoneOccupancyChanged` (Aforo, Rafa).
  - Salida: `FlashMissionAlertRequested` (Notificaciones, Rafa), `HapticFeedbackRequested` (Accesibilidad, Javi), `StandRatingSubmitted` (Dashboard, Joselu).
  - Mientras no exista el NFC real, un panel de desarrollo simula los escaneos.
- **Offline y sincronización:** se sigue el patrón de la Spec 07. Todo se escribe primero en SQLite con `synced = false`. Al recuperar la red se sube con `upsert` ignorando duplicados (`ON CONFLICT DO NOTHING`), así que reintentar no duplica sellos ni puntos. El multiplicador se fija en el momento del escaneo, aunque la zona cambie mientras se responde la trivia.
- **Sincronización (detalles):** solo dos datos cambian después de subirse: el resultado de la trivia (si el sello se subió antes de responderla) y el estado de una tirada (girada, usada o canjeada). El resto es inmutable y no tiene policy de UPDATE ni DELETE. Igual que en `eventos`, RLS permite escribir a cualquier sesión autenticada; vincular las filas a `auth.uid()` queda fuera de alcance.
- **Rendimiento:** el sello y la vibración deben llegar en menos de 200 ms desde el escaneo, con o sin red, y el flujo completo sello → trivia → valoración en menos de 20 s.
- **Tecnologías:** Expo + TypeScript `strict`, `expo-sqlite`, `expo-network`, Supabase y `react-native-svg` + `Animated` para la ruleta. Tests con `node:test` (`npm run test:domain`). No se añaden dependencias nuevas. Se usa `expo-sqlite` en lugar de WatermelonDB (la constitución lo recomienda) porque es lo que ya usa el resto de la app.
- **Supuestos:** un dispositivo por asistente; trivias, estands, zonas y configuración de la ruleta se descargan antes del evento.
- **Fuera de alcance:** realizar el sorteo y entregar los premios físicos (aquí solo se registran los boletos y los premios), y la UI para asignar zona a cada estand.
