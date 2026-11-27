# Spec 09: UI del Pasaporte Digital de Sellos

**Owner:** @Samu
**Rama:** `Samu`
**Issue:** TASK-10 · Prioridad Media · 3 puntos
**Estado:** 📝 Aprobado
**Depende de:** Spec 04 (gamificación y pasaporte) y Spec 08 (pestaña `pasaporte` por rol)
**Desbloquea:** T030, T031 y T045 de `specs/004-gamification-passport/tasks.md` (conexión con datos reales y NFC)
**Fecha:** 2026-11-27
**Objetivo:** Maquetar con datos mock la pantalla del pasaporte, con tarjetas de sello bloqueadas y desbloqueadas, lista para conectarse después a las lecturas NFC.

## 1. Descripción Funcional

El asistente abre la pestaña Pasaporte y ve sus sellos en una cuadrícula de 2 columnas.

Cada estand del evento es una tarjeta. Si el asistente no lo ha visitado, la tarjeta está bloqueada: muestra un candado y no revela el nombre del estand. Si lo ha visitado, la tarjeta está desbloqueada: muestra el sello, el nombre del estand, la fecha del sello, el XP ganado y, si existe, la valoración en estrellas.

Encima de la cuadrícula, una cabecera muestra el XP total, los sellos conseguidos sobre el total («3/8 sellos») y una barra de progreso.

Al pulsar una tarjeta desbloqueada se abre una ficha de solo lectura con su detalle. Al pulsar una bloqueada se abre la misma ventana con la pista «Acerca tu móvil al NFC del estand para conseguir este sello».

Esta spec es solo maquetación. Los datos salen de un mock tipado. No hay lectura NFC, ni SQLite, ni Supabase. La pantalla recibe sus datos por props con un contrato (`PassportViewData`) que más tarde rellenará `usePassport` (T031).

## 2. Alcance

**Incluido:**

- View model de presentación `PassportViewData` y funciones puras para el progreso, las etiquetas accesibles y el formato de fecha.
- Mock con 4 escenarios: `sinEstands`, `sinSellos`, `parcial` y `completo`.
- Componente de tarjeta de sello con estados bloqueado y desbloqueado.
- Cabecera con XP total, «n/total sellos» y barra de progreso.
- Ventana modal con dos variantes: detalle (desbloqueada) y pista (bloqueada).
- Dos estados vacíos: evento sin estands y evento con estands pero sin sellos.
- Selector de escenario del mock, visible solo con `__DEV__`.
- La ruta `src/app/(tabs)/pasaporte.tsx` pasa a mostrar `PassportScreen`.
- Tests de las funciones puras del view model.

**Fuera de alcance (specs o tareas futuras):**

- Lectura NFC y simulador de escaneo (`devSimulators`, T027).
- Lectura y escritura en SQLite y sincronización con Supabase (`usePassport`, T031).
- Micro-Trivia, valoración interactiva y «Pendientes de valorar» (T030 y T031).
- Ruleta, insignias (`AchievementGrid`, T060), facciones (T045) y ranking (T067).
- Reglas reales del pasaporte (sellados, pendientes, umbral de recompensa) y `RatingRepository` (TASK-23: T079–T082).

## 3. Modelo de Datos

Esta spec no crea tablas ni toca SQLite. Solo introduce tipos de presentación.

`app-eventos/src/domain/gamification/passportView.ts` (sin imports de React Native ni Expo, para poder testearlo con Node):

```ts
export type EstrellasValoracion = 1 | 2 | 3 | 4 | 5;

export type PassportStampCardData =
  | { estado: 'BLOQUEADO'; standId: string }
  | {
      estado: 'DESBLOQUEADO';
      standId: string;
      standName: string;
      scannedAt: string; // ISO 8601
      xpGanada: number;
      estrellas: EstrellasValoracion | null;
    };

export interface PassportViewData {
  xpTotal: number;
  sellos: PassportStampCardData[]; // un elemento por estand del evento
}

export interface ProgresoPasaporte {
  conseguidos: number;
  total: number;
  porcentaje: number; // 0..100, entero; 0 si total = 0
}
```

Funciones puras del mismo fichero:

- `calcularProgreso(sellos): ProgresoPasaporte`.
- `etiquetaAccesibleSello(card, indice, total): string`. Bloqueada: «Sello 2 de 8, bloqueado». Desbloqueada: «Sello 1 de 8, Estand Café, conseguido el 27/11 a las 10:32, 100 XP, 4 de 5 estrellas».
- `formatearFechaSello(iso): string`, con formato `dd/MM HH:mm` en hora local.

Reglas:

- Una tarjeta `BLOQUEADO` nunca lleva el nombre del estand. El tipo lo impide.
- `total` es el número de estands del evento (`sellos.length`).
- `xpTotal` llega ya calculado. La pantalla no suma XP (el XP total incluye trivia, valoraciones e insignias, que no salen en las tarjetas).

Mock en `app-eventos/src/domain/gamification/passportMockData.ts`:

```ts
export type EscenarioPasaporte = 'sinEstands' | 'sinSellos' | 'parcial' | 'completo';
export const ESCENARIOS_PASAPORTE: Record<EscenarioPasaporte, PassportViewData>;
export const ESCENARIO_POR_DEFECTO: EscenarioPasaporte = 'parcial';
```

## 4. Plan de Implementación

Todas las rutas son relativas a `app-eventos/`. Cada paso deja la app arrancando sin errores.

1. **View model.** Crear `src/domain/gamification/passportView.ts` con los tipos y las 3 funciones puras. Crear `tests/passportView.test.mjs`. Comprobación: `npm run test:domain` en verde.
2. **Mock.** Crear `src/domain/gamification/passportMockData.ts` con los 4 escenarios. `parcial` tiene 8 estands y 3 sellos (uno sin valoración). `completo` tiene todos los sellos desbloqueados.
3. **Tarjeta.** Crear `src/components/PassportStampCard.tsx`. Bloqueada: icono de candado y texto «Bloqueado». Desbloqueada: icono de sello, nombre, fecha, «+N XP» y estrellas (texto «★★★★☆», o «Sin valorar»). Es un `Pressable` con `accessibilityRole="button"`, `accessibilityLabel` del view model y un área mínima de 44x44.
4. **Cabecera.** Crear `src/components/PassportHeader.tsx` con «N XP», «n/total sellos» y una barra con `accessibilityRole="progressbar"` y `accessibilityValue={{ min: 0, max: total, now: conseguidos }}`.
5. **Ventana modal.** Crear `src/components/PassportStampDetailModal.tsx` (`Modal` de React Native). Variante detalle con los datos del sello. Variante pista con el título «Sello bloqueado» y el texto «Acerca tu móvil al NFC del estand para conseguir este sello». Las dos tienen el botón «Cerrar».
6. **Pantalla.** Crear `src/screens/PassportScreen.tsx`. Exporta `PassportView` (recibe `PassportViewData` por props) y por defecto `PassportScreen` (contenedor que toma el escenario del mock y muestra el selector con `__DEV__`). `PassportView` usa `FlatList` con `numColumns={2}`, la cabecera y los dos estados vacíos:
   - Sin estands: «Este evento aún no tiene estands».
   - Con estands y sin sellos: la cuadrícula completa de tarjetas bloqueadas y el texto «Visita un estand y acerca tu móvil a su NFC para tu primer sello».
7. **Ruta.** Cambiar `src/app/(tabs)/pasaporte.tsx` para que reexporte `PassportScreen`. `ProximamenteScreen` no se borra: lo siguen usando otras pestañas.

## 5. Historias de Usuario

### [US-09.1] Ver mi pasaporte de sellos (TASK-10)
- **Como** asistente
- **Quiero** ver en una cuadrícula qué estands he sellado y cuáles me faltan
- **Para** saber mi progreso y qué estands visitar

**Criterios de Aceptación (Definition of Done):**
- [ ] La pestaña Pasaporte muestra `PassportScreen`, no «Próximamente».
- [ ] Los sellos se muestran en una cuadrícula de 2 columnas.
- [ ] Una tarjeta bloqueada muestra un candado y el texto «Bloqueado», y no muestra el nombre del estand.
- [ ] Una tarjeta desbloqueada muestra el nombre del estand, la fecha `dd/MM HH:mm`, «+N XP» y las estrellas o «Sin valorar».
- [ ] El estado de cada tarjeta se distingue sin color (icono y texto distintos).
- [ ] La cabecera muestra el XP total y «n/total sellos». Con el escenario `parcial` muestra «3/8 sellos».
- [ ] Con `sinEstands` se ve «Este evento aún no tiene estands» y ninguna tarjeta.
- [ ] Con `sinSellos` se ven todas las tarjetas bloqueadas y el texto «Visita un estand y acerca tu móvil a su NFC para tu primer sello».

### [US-09.2] Consultar un sello (TASK-10)
- **Como** asistente
- **Quiero** tocar un sello para ver su detalle, o una pista si está bloqueado
- **Para** recordar qué conseguí y saber cómo conseguir lo que me falta

**Criterios de Aceptación (Definition of Done):**
- [ ] Tocar una tarjeta desbloqueada abre la ventana con el nombre, la fecha, el XP y la valoración del sello.
- [ ] Tocar una tarjeta bloqueada abre la ventana con «Acerca tu móvil al NFC del estand para conseguir este sello».
- [ ] La ventana se cierra con el botón «Cerrar» y con el botón atrás de Android.
- [ ] La ventana es de solo lectura: no permite valorar ni responder trivia.

### [US-09.3] Pasaporte accesible y listo para integrarse (TASK-10)
- **Como** desarrollador del equipo
- **Quiero** una pantalla accesible que reciba sus datos por props
- **Para** conectarla después a `usePassport` sin rehacer la UI

**Criterios de Aceptación (Definition of Done):**
- [x] Cada tarjeta tiene `accessibilityRole="button"` y el `accessibilityLabel` de `etiquetaAccesibleSello`.
- [x] Cada tarjeta tiene un área táctil de al menos 44x44.
- [x] La barra de progreso tiene `accessibilityRole="progressbar"` y `accessibilityValue`.
- [x] `PassportView` recibe `PassportViewData` por props y no importa el mock.
- [x] El selector de escenario solo aparece con `__DEV__`. Sin `__DEV__` se usa `parcial`.
- [x] Ningún fichero nuevo importa de `src/database/`, `src/sync/`, `src/nfc/` ni `@supabase`.
- [x] `passportView.ts` y `passportMockData.ts` no importan `react-native` ni `expo`.
- [x] `tests/passportView.test.mjs` cubre `calcularProgreso` (0 estands da 0 %, 3 de 8 da 38 %, 8 de 8 da 100 %), las dos variantes de `etiquetaAccesibleSello` (la bloqueada no contiene el nombre) y `formatearFechaSello`.
- [x] `npm run test:domain`, `npx tsc --noEmit` y `npm run lint` pasan.

## 6. Decisiones Tomadas y Descartadas

- **Sí:** solo maquetación con mock. Es lo que pide TASK-10. La lógica (T019–T031) va aparte.
- **Sí:** view model propio (`PassportViewData`) en `src/domain/gamification/passportView.ts`, junto al mock en `passportMockData.ts`. Sigue el precedente de `src/domain/map/mapMockData.ts` y se testea con Node.
- **No:** usar directamente `PassportStamp` de `src/domain/gamification/types.ts`. Es la fila de `user_stamps`: no lleva el nombre del estand, el XP ni la valoración, y no representa los estands sin sello.
- **Sí:** estructura plana del proyecto (`src/domain`, `src/components`, `src/screens`), no `src/modules/gamification/`. Es donde vive ya el código de la Fase 1–2 de la Spec 04.
- **Sí:** `calcularProgreso` vive en `passportView.ts` y TASK-23 (T080) la reutiliza en `computePassport`. Así no se duplica el cálculo del progreso.
- **Sí:** unión discriminada por `estado`. El tipo impide que una tarjeta bloqueada lleve el nombre del estand.
- **Sí:** cuadrícula de 2 columnas. Se parece a un pasaporte con sellos y caben los datos.
- **No:** lista vertical. Cabe más texto, pero se pierde el aspecto de pasaporte.
- **No:** cuadrícula de 3 columnas. Los datos quedan apretados.
- **Sí:** las dos tarjetas son pulsables: detalle o pista. Ayuda a que el asistente sepa cómo conseguir el sello.
- **Sí:** un solo modal con dos variantes para la pista. No necesita dependencias y es accesible.
- **No:** toast para la pista. React Native no lo trae en iOS: habría que programarlo o añadir una librería.
- **Sí:** cabecera con XP, «n/total» y barra. Cubre FR-006 (total de XP) y muestra el progreso.
- **Sí:** dos estados vacíos distintos. Un evento sin estands y un asistente sin sellos son situaciones diferentes.
- **Sí:** mock con 4 escenarios y selector `__DEV__`. Permite revisar todos los estados sin editar código.
- **No:** mock fijo. Obliga a editar el fichero para ver cada caso.
- **Sí:** `PassportView` (presentacional) separado de `PassportScreen` (contenedor). T031 solo cambia la fuente de datos.
- **Sí:** T032 de la Spec 04 se elimina porque se solapa con esta task. Sus restos se reparten: montar `StampFlowModal` y el panel dev pasa a T030, y «Pendientes de valorar» pasa a T031.

## 7. Riesgos Identificados

| Riesgo | Mitigación |
| --- | --- |
| `tasks.md` de la Spec 04 cita rutas `src/modules/gamification/` que no existen | El código real está en la estructura plana. `tasks.md` tiene una nota con la tabla de equivalencias. |
| TASK-23 cambia la forma de los datos | `toPassportViewData` (T080) produce `PassportViewData`. La UI no cambia. |
| El mock se ve en producción hasta que llegue T031 | Se acepta. Es el objetivo de TASK-10. El selector solo aparece en `__DEV__`. |
| T031 devuelve datos con otra forma | `PassportViewData` es el contrato. T031 lo cita y debe devolverlo. |
| Nombres de estand largos rompen la tarjeta | `numberOfLines={2}` en el nombre. El nombre completo se ve en la ficha. |

## Lo que **no** incluye este spec

- Lectura NFC, escaneo simulado ni feedback háptico.
- SQLite, Supabase ni sincronización.
- Trivia, valoración interactiva y «Pendientes de valorar».
- Ruleta, insignias, facciones y ranking.
- Tipos de dominio en `domain/types.ts`.
