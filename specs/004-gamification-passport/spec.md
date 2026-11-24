# Feature Specification: Motor de Gamificación, Pasaporte Digital y Valoración

**Feature Branch**: `004-gamification-passport`

**Created**: 2026-11-22

**Status**: Draft

**Owner**: Samu (Integrante 4 - Gamificación, Pasaporte y Feedback)

**Input**: User description: "Motor de gamificación offline-first integrado en la app de gestión de eventos con pulseras NFC: sellado NFC con Micro-Trivia y valoración (US1), batalla de facciones y misiones relámpago por aforo (US2), ruleta de recompensa variable cada X sellos (US3), insignias ocultas evaluadas en local (US4) y ranking público de estands y marcador de facciones (US5), con libro mayor inmutable de transacciones de XP, sincronización idempotente y feedback háptico."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Sellado NFC, Micro-Trivia y Valoración de Estand (Priority: P1)

Como asistente del evento, quiero acercar mi móvil al tag NFC de un estand para obtener su sello en mi pasaporte digital, responder una pregunta rápida sobre el expositor y puntuarlo de 1 a 5 estrellas, incluso si no hay conexión a internet en el recinto.

**Why this priority**: Es el flujo central de interacción en cada estand; sin él no existen sellos, puntos ni valoraciones, y el resto de historias dependen de él.

**Independent Test**: Con el dispositivo en modo avión, leer (o simular la lectura de) el tag NFC de un estand, completar Micro-Trivia y valoración, y comprobar que el sello, los puntos y la valoración quedan guardados en el dispositivo y aparecen en el pasaporte.

**Acceptance Scenarios**:

1. **Given** un asistente sin conexión a internet que nunca ha visitado el estand, **When** escanea por primera vez su tag NFC, **Then** se desbloquea el sello del estand en su pasaporte, recibe 100 XP base y se le muestra la Micro-Trivia del estand.
2. **Given** el asistente ve la Micro-Trivia (3 opciones, 15 segundos), **When** selecciona la opción correcta antes de que se agote el tiempo, **Then** recibe +50 XP adicionales.
3. **Given** el asistente ve la Micro-Trivia, **When** elige una opción incorrecta o se agota el tiempo, **Then** no recibe XP extra pero conserva íntegramente el sello y sus 100 XP base.
4. **Given** el asistente ha terminado la Micro-Trivia, **When** envía una valoración de 1 a 5 estrellas, **Then** recibe +25 XP fijos y su valoración pasa a contar para el ranking público de estands.
5. **Given** el asistente ya selló previamente el estand, **When** vuelve a escanear el mismo tag NFC, **Then** se le informa de que el estand ya fue visitado, se muestra su valoración previa y no se generan sellos, trivias ni puntos duplicados.

---

### User Story 2 - Batalla de Facciones y Misiones Relámpago por Aforo (Priority: P1)

Como asistente asignado a una facción al recibir mi pulsera en puerta, quiero que los puntos que gano sumen al marcador global de mi equipo y obtener un multiplicador ×2 cuando visito estands situados en zonas con baja ocupación.

**Why this priority**: Conecta la gamificación con la gestión de flujos del recinto (redirige asistentes a zonas vacías) y crea competición colectiva desde el primer minuto.

**Independent Test**: Asignar dos asistentes a facciones distintas, poner una zona en estado de baja ocupación (`GREEN`), escanear un estand de esa zona y comprobar que el sello y la trivia se puntúan con ×2 y que los puntos suman al marcador de la facción correcta.

**Acceptance Scenarios**:

1. **Given** un asistente al que se le graba la pulsera en puerta, **When** se completa el alta, **Then** queda asignado a exactamente una facción del evento.
2. **Given** un asistente con facción, **When** gana puntos por sello, trivia, valoración, insignia o ruleta, **Then** esos puntos se suman a su perfil individual y al total de su facción.
3. **Given** la zona de un estand está en baja ocupación (`GREEN`) en el instante del escaneo, **When** el asistente sella ese estand por primera vez, **Then** el sello se puntúa con 200 XP (100 × 2.0) y un acierto de trivia con 100 XP (50 × 2.0); la valoración sigue otorgando 25 XP.
4. **Given** una zona cambia a baja ocupación (`GREEN`), **When** no se ha enviado aviso de esa zona en los últimos 20 minutos, **Then** el asistente recibe una notificación de Misión Relámpago indicando la zona y el bono ×2.
5. **Given** se envió un aviso de Misión Relámpago de una zona hace menos de 20 minutos, **When** la zona vuelve a cambiar a `GREEN`, **Then** no se envía una nueva notificación de esa zona (el multiplicador sí se sigue aplicando).

---

### User Story 3 - Ruleta de Recompensa Variable cada X Sellos (Priority: P2)

Como asistente, quiero desbloquear una tirada en una ruleta animada cada vez que acumule X sellos para obtener recompensas variables: XP extra, potenciadores, boletos de sorteo o premios físicos.

**Why this priority**: Sustituye recompensas lineales por refuerzo variable y mantiene la motivación durante todo el evento, pero requiere que exista el sellado (US1).

**Independent Test**: Acumular 3 sellos (X por defecto), comprobar que se habilita una tirada, girar la ruleta y verificar que la recompensa queda registrada y aplicada.

**Acceptance Scenarios**:

1. **Given** un asistente con X − 1 sellos, **When** consigue un nuevo sello y alcanza un múltiplo de X, **Then** se habilita una tirada pendiente en la ruleta.
2. **Given** el asistente tiene una tirada pendiente, **When** gira la ruleta y termina la animación, **Then** obtiene uno de los premios configurados según su probabilidad: 40 % +200 XP, 30 % multiplicador personal ×1.5 en el siguiente estand, 20 % boleto extra de sorteo, 10 % premio físico canjeable.
3. **Given** el asistente obtuvo el multiplicador personal ×1.5, **When** sella su siguiente estand nuevo, **Then** el ×1.5 se aplica al sello y a la trivia de ese estand y después se consume.
4. **Given** el asistente obtuvo un premio físico, **When** consulta su pasaporte, **Then** ve el premio como pendiente de canje hasta que el personal lo marque como canjeado.

---

### User Story 4 - Insignias Ocultas Evaluadas en Local (Priority: P2)

Como asistente, quiero desbloquear insignias ocultas al cumplir hitos de exploración o velocidad, con reconocimiento inmediato aunque no haya conexión.

**Why this priority**: Incentiva comportamientos concretos (llegar pronto, valorar, explorar zonas completas, encadenar visitas), pero es un refuerzo sobre el flujo principal.

**Independent Test**: En modo avión, sellar 3 estands distintos en menos de 5 minutos y comprobar el desbloqueo inmediato de `SPEEDRUNNER` con su XP y feedback háptico.

**Acceptance Scenarios**:

1. **Given** un asistente que consigue su primer sello en los primeros 15 minutos desde la apertura del evento, **When** se registra el sello, **Then** desbloquea `EARLY_BIRD` (+150 XP).
2. **Given** un asistente que ha valorado 4 estands distintos, **When** envía la valoración de un quinto estand distinto, **Then** desbloquea `EXPERT_CRITIC` (+200 XP).
3. **Given** un asistente al que le falta un estand de una zona para tenerlos todos, **When** sella ese último estand, **Then** desbloquea `SECTOR_EXPLORER` (+300 XP).
4. **Given** un asistente que sella 3 estands distintos con no más de 5 minutos entre el primero y el tercero, **When** se registra el tercer sello, **Then** desbloquea `SPEEDRUNNER` (+250 XP).
5. **Given** un asistente que ya tiene una insignia, **When** vuelve a cumplir su condición, **Then** no se desbloquea de nuevo ni se otorga XP adicional.
6. **Given** un asistente que no ha desbloqueado una insignia, **When** consulta su pasaporte, **Then** la insignia aparece oculta (sin revelar su condición).

---

### User Story 5 - Ranking Público de Estands y Marcador de Facciones (Priority: P3)

Como asistente y como organizador, quiero consultar la clasificación pública de los estands mejor valorados y el marcador de la batalla de facciones.

**Why this priority**: Visibiliza el resultado de las valoraciones y de la competición, pero solo aporta valor una vez existen datos de US1 y US2.

**Independent Test**: Registrar valoraciones de distintas puntuaciones en varios estands, sincronizar y comprobar que el ranking los ordena por media bayesiana ponderada y que el marcador muestra el total por facción.

**Acceptance Scenarios**:

1. **Given** valoraciones registradas en varios estands, **When** un usuario abre el ranking, **Then** ve los estands ordenados por media bayesiana ponderada, de forma que un estand con pocas valoraciones no supera a uno con muchas solo por tener una única nota de 5 estrellas.
2. **Given** transacciones de XP sincronizadas de varios dispositivos, **When** se consulta el marcador de facciones, **Then** se muestra el total de puntos de cada facción, igual a la suma de las transacciones de sus miembros.
3. **Given** el dispositivo no tiene conexión, **When** se abre el ranking o el marcador, **Then** se muestran los últimos datos conocidos junto a la hora de su última actualización.

---

### Edge Cases

- **Pérdida de conexión en mitad del flujo**: Todo (sello, trivia, valoración, ruleta, insignias, XP) se guarda primero en el dispositivo marcado como pendiente de sincronizar y se envía automáticamente al recuperar la red.
- **Reintentos de sincronización**: Si un envío se repite tras un corte intermitente, el servidor no duplica sellos, valoraciones, insignias, tiradas ni puntos (idempotencia por identificador único y por la pareja asistente–estand).
- **Cambio de aforo durante el escaneo**: El multiplicador aplicable es el vigente en el instante del escaneo del tag NFC, aunque la zona cambie de color mientras el asistente responde la trivia.
- **Aforo no disponible o desactualizado**: Si no hay dato válido de ocupación de la zona, no se aplica el ×2 (nunca se trata como `GREEN`, en línea con la Spec 03).
- **Cierre de la app antes de valorar**: El sello y la trivia quedan registrados; la valoración queda pendiente y se puede completar desde el pasaporte, otorgando entonces los 25 XP.
- **Cierre de la app durante la trivia**: Se considera respuesta fallida al reabrir; el sello y los 100 XP se mantienen y no se puede repetir la trivia.
- **Estand sin trivia configurada**: Se omite la Micro-Trivia y se pasa directamente a la valoración.
- **Tag NFC desconocido o de otro evento**: Se informa de que el tag no corresponde a ningún estand del evento y no se otorga nada.
- **Asistente sin facción** (p. ej. alta incompleta en puerta): Gana XP individual, que se suma a su facción en cuanto se le asigne.
- **Tirada de ruleta interrumpida**: Si la app se cierra durante la animación, el premio ya determinado se conserva y se muestra al reabrir; la tirada no se repite.
- **Varias tiradas acumuladas**: Si el asistente alcanza varios múltiplos de X sin girar, conserva todas las tiradas pendientes.
- **Multiplicadores simultáneos**: Si coinciden el ×2.0 de zona y el ×1.5 personal, se multiplican (×3.0) sobre sello y trivia.

## Requirements *(mandatory)*

### Functional Requirements

**Sellado, trivia y valoración (US1)**

- **FR-001**: El sistema DEBE registrar como máximo un sello por pareja asistente–estand (`UNIQUE(user_id, stand_id)`) al leer por primera vez el tag NFC del estand, otorgando 100 XP base.
- **FR-002**: El sistema DEBE mostrar tras el primer sellado una Micro-Trivia del estand, disponible sin conexión, con 3 opciones y un límite de 15 segundos; un acierto otorga +50 XP base y un fallo o tiempo agotado otorga 0 XP extra sin afectar al sello.
- **FR-003**: Cada asistente DEBE poder responder la Micro-Trivia de un estand una sola vez.
- **FR-004**: El sistema DEBE permitir valorar el estand de 1 a 5 estrellas tras la trivia, otorgando +25 XP fijos (sin multiplicadores) una sola vez por pareja asistente–estand.
- **FR-005**: Al reescanear un estand ya sellado, el sistema DEBE informar de la visita previa y mostrar la valoración existente sin generar sellos, trivias ni XP.
- **FR-006**: El pasaporte DEBE mostrar los sellos obtenidos, los estands pendientes de valorar y el total de XP del asistente.

**Facciones y Misiones Relámpago (US2)**

- **FR-007**: El sistema DEBE asignar a cada asistente exactamente una facción del evento al grabar su pulsera en puerta.
- **FR-008**: Todo XP ganado por un asistente DEBE contabilizarse también para su facción.
- **FR-009**: El sistema DEBE aplicar automáticamente un multiplicador 2.0× al XP del sello y de la trivia cuando la zona del estand esté en baja ocupación (`GREEN`, según la clasificación de la Spec 03) en el instante del escaneo.
- **FR-010**: El sistema DEBE notificar al asistente cuando una zona pase a `GREEN`, con un enfriamiento de 20 minutos por zona entre notificaciones.

**Ruleta (US3)**

- **FR-011**: El sistema DEBE habilitar una tirada de ruleta cada vez que el número de sellos del asistente alcance un múltiplo de X (X = 3 por defecto, configurable por evento).
- **FR-012**: La ruleta DEBE elegir el premio según probabilidades configurables por evento, con estos valores por defecto: 40 % +200 XP, 30 % multiplicador personal ×1.5 en el siguiente estand, 20 % boleto extra de sorteo, 10 % premio físico canjeable. Las probabilidades configuradas DEBEN sumar 100 %.
- **FR-013**: El multiplicador personal ×1.5 DEBE aplicarse al sello y a la trivia del siguiente estand nuevo sellado y consumirse después.
- **FR-014**: Los premios físicos DEBEN quedar registrados como pendientes de canje hasta que el personal los marque como canjeados.

**Insignias ocultas (US4)**

- **FR-015**: El sistema DEBE evaluar en el dispositivo, sin conexión, tras cada sello o valoración, las insignias: `EARLY_BIRD` (primer sello en los primeros 15 min desde la apertura del evento, +150 XP), `EXPERT_CRITIC` (5 estands distintos valorados, +200 XP), `SECTOR_EXPLORER` (100 % de los estands de una misma zona sellados, +300 XP) y `SPEEDRUNNER` (3 estands distintos sellados en ≤ 5 minutos, +250 XP).
- **FR-016**: Cada insignia DEBE desbloquearse como máximo una vez por asistente y su condición DEBE permanecer oculta hasta desbloquearla.

**Ranking y marcador (US5)**

- **FR-017**: El sistema DEBE exponer un ranking público de estands ordenado por media bayesiana ponderada de sus valoraciones.
- **FR-018**: El sistema DEBE exponer el total de puntos por facción, calculado como la suma de las transacciones de XP de sus miembros.
- **FR-019**: Sin conexión, el ranking y el marcador DEBEN mostrar los últimos datos conocidos y su hora de actualización.

**Persistencia, sincronización y feedback (transversal)**

- **FR-020**: Todas las operaciones de las historias 1–4 DEBEN funcionar sin conexión a internet.
- **FR-021**: Todo movimiento de puntos DEBE registrarse en un libro mayor inmutable (`xp_transactions`, solo inserción) con origen, XP base, multiplicador y XP final; nunca se sobrescribe un contador de puntos.
- **FR-022**: Los registros creados sin conexión DEBEN quedar marcados como pendientes (`synced = false`) y sincronizarse automáticamente al recuperar la red de forma idempotente, sin duplicar sellos, valoraciones, insignias, tiradas ni puntos.
- **FR-023**: El sistema DEBE emitir eventos de feedback háptico diferenciados: `STAMP_SUCCESS` al obtener un sello, `ACHIEVEMENT_UNLOCKED` al desbloquear una insignia y `ROULETTE_WIN` al obtener un premio de la ruleta.

### Key Entities *(include if feature involves data)*

- **Faction**: Equipo al que pertenece cada asistente en un evento (nombre, color). Un evento tiene varias facciones; un asistente pertenece a una.
- **PassportStamp**: Visita única de un asistente a un estand: momento del escaneo, multiplicador aplicado, resultado de la trivia, estado de sincronización.
- **StandTrivia**: Pregunta de 3 opciones asociada a un estand, con la opción correcta y el bono de XP; disponible en el dispositivo antes del escaneo.
- **StandRating**: Valoración de 1 a 5 estrellas de un asistente sobre un estand (única por pareja asistente–estand).
- **XpTransaction**: Movimiento inmutable de puntos de un asistente y su facción: origen (sello, trivia, valoración, insignia, ruleta), referencia al registro que lo origina, XP base, multiplicador, XP final, fecha y estado de sincronización.
- **UserAchievement**: Insignia desbloqueada por un asistente (código, fecha de desbloqueo).
- **RouletteSpin**: Tirada habilitada al alcanzar un múltiplo de X sellos: número de sellos que la disparó, premio obtenido, fecha de giro y estado de canje/consumo.
- **Relaciones con módulos existentes**: Estand y Zona (Spec 03, mapa y aforo), Evento (Spec 07) y pulsera/asistente (Spec 05, control de accesos).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Un asistente completa el flujo sello → trivia → valoración de un estand en menos de 20 segundos (además del tiempo que dedique a leer la pregunta).
- **SC-002**: El sello, el multiplicador y la vibración de confirmación se perciben como inmediatos (menos de 200 ms tras la lectura del tag), con o sin conexión.
- **SC-003**: El 100 % de los sellos, valoraciones, insignias, tiradas y puntos generados sin conexión llegan al servidor tras reconectar, sin duplicados ni pérdidas, incluso si el envío se repite varias veces.
- **SC-004**: El total de cada facción en el marcador coincide exactamente con la suma de los puntos de sus miembros una vez sincronizados.
- **SC-005**: Con 1 000 tiradas simuladas, la frecuencia de cada premio de la ruleta se desvía como máximo ±5 puntos porcentuales de su probabilidad configurada.
- **SC-006**: Ningún asistente puede obtener más de un sello, una valoración puntuada o una insignia de cada tipo por estand/insignia, verificado reescaneando y repitiendo acciones.
- **SC-007**: Las zonas en `GREEN` reciben más visitas de sellado durante los 20 minutos posteriores al aviso de Misión Relámpago que en los 20 minutos anteriores.

## Assumptions

- **Sello y valoración**: La valoración se puede omitir en el momento y completarse más tarde desde el pasaporte; una vez enviada no se modifica.
- **Multiplicadores**: El ×2.0 de zona y el ×1.5 personal se multiplican (×3.0) y se aplican solo a sello y trivia; la valoración, las insignias y los premios de la ruleta no se multiplican.
- **Baja ocupación**: `GREEN` corresponde al estado verde del semáforo de la Spec 03 (ocupación inferior al 70 %, con dato de aforo válido).
- **Apertura del evento**: Los "primeros 15 minutos" de `EARLY_BIRD` se cuentan desde la hora de inicio del evento.
- **`SPEEDRUNNER`**: Se evalúa sobre cualquier ventana de 5 minutos entre tres sellos distintos consecutivos.
- **`SECTOR_EXPLORER`**: Se desbloquea una sola vez, al completar la primera zona con al menos un estand.
- **Media bayesiana**: Puntuación = (v·R + m·C) / (v + m), donde v es el número de valoraciones del estand, R su media, C la media global de todos los estands del evento y m = 5 valoraciones mínimas de referencia.
- **Asignación de facción**: Se hace automáticamente al grabar la pulsera, repartiendo a los asistentes de forma equilibrada entre las facciones del evento; el número y nombre de facciones lo configura la organización.
- **Un dispositivo por asistente**: No se contempla que un mismo asistente use varios dispositivos a la vez.
- **Contenido precargado**: Trivias, estands, zonas y configuración de la ruleta se descargan al dispositivo antes del evento o en la última sincronización.
- **Sorteo y premios físicos**: Esta spec registra boletos y premios; la ejecución del sorteo y la logística de entrega quedan fuera de alcance.
- **Dependencias**: Requiere la lectura NFC y el alta de pulseras en puerta (Spec 05), el mapa, estands, zonas y aforo (Spec 03) y la sincronización de eventos (Spec 07).
