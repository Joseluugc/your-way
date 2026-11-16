# Your Way

Plataforma de gestión de eventos y festivales basada en **pulseras NFC** y diseñada para funcionar **sin conexión (offline-first)**. Proyecto de la asignatura ISM.

## ¿Qué hace?

La pulsera NFC es el identificador único de cada asistente. A partir de ella el sistema ofrece:

- **Acreditación y vinculación NFC:** el organizador vincula a cada invitado con una pulsera en la entrada.
- **Intercambio de contactos (lead retrieval):** escanear la pulsera de otra persona guarda su contacto al instante.
- **Gamificación ("Passport to Prizes"):** puntos NFC en los estands otorgan sellos; acumular suficientes desbloquea recompensas.
- **Control de acceso y aforo:** zonas restringidas por rol (VIP, Staff…) y ocupación por sala en tiempo real.
- **Feedback de estands:** valoración de 1 a 5 estrellas y ranking público.
- **Mapa, aforo y notificaciones:** plano 2D interactivo con semáforo de ocupación y avisos de la organización.
- **Dashboard del organizador:** estadísticas locales (usuarios por rol, sellos y valoraciones por estand, leads, ocupación por zona).

Todas las lecturas y cambios se guardan primero en una base de datos local y se sincronizarán con el servidor cuando haya conexión estable (fase posterior).

## Stack

| Capa | Tecnología |
|---|---|
| App móvil | React Native 0.88, Expo 58, Expo Router, TypeScript estricto |
| NFC | `react-native-nfc-manager` |
| Almacenamiento local | SQLite (`expo-sqlite`) |
| Mapa | `react-native-svg` |
| Notificaciones | `expo-notifications` |
| Backend (futuro) | Node.js + PostgreSQL (esquema en `schema.sql`) |

## Estructura del repositorio

```
your-way/
├── app-eventos/        # App móvil (Expo)
│   ├── src/app/        # Rutas (Expo Router): inicio y dashboard
│   ├── src/screens/    # Pantallas: crear evento, mapa, dashboard del organizador
│   ├── src/hooks/      # Hooks que conectan UI y persistencia
│   ├── src/domain/     # Lógica de negocio agnóstica a React Native (aforo, alertas)
│   ├── src/database/   # Repositorios y esquema SQLite
│   ├── src/providers/  # Proveedor de notificaciones
│   └── tests/          # Tests del dominio
├── specs/              # Especificaciones por sprint (Spec 01, Spec 03…)
├── spec.md             # Especificación general del sistema
├── plan.md             # Hoja de ruta por fases
├── tasks.md            # Product backlog de la Fase 1
├── constitution.md     # Reglas, stack y acuerdos del equipo
├── schema.sql          # Esquema PostgreSQL del backend
├── .github/skills/     # Skills de Spec Kit / Copilot
└── .specify/           # Plantillas y scripts de Spec Kit
```

## Arquitectura

Arquitectura hexagonal con DDD: la lógica de negocio (`src/domain`) no depende de React Native; la UI y los hooks de persistencia están separados siguiendo un patrón Presenter/MVC. El código debe funcionar offline antes de desarrollar la sincronización.

## Puesta en marcha

Requisitos: Node.js y npm; Expo Go o un emulador Android/iOS.

```bash
cd app-eventos
npm install
npm start          # Expo dev server
npm run android    # o: npm run ios / npm run web
```

Otros comandos:

```bash
npm run lint         # ESLint (expo lint)
npm run test:domain  # tests de la lógica de dominio
```

> La lectura NFC requiere un dispositivo físico con NFC; no funciona en emuladores ni en web.

## Hoja de ruta

1. **Arquitectura base y entorno:** repo, CI/CD, app multiplataforma, modelo de dominio, base local.
2. **Core NFC y gestión local:** lectura/escritura NFC, vinculación de pulseras, intercambio de contactos.
3. **Gamificación y aforo:** sellos, permisos por zona, cálculo de aforo.
4. **Sincronización y analíticas:** servidor central, cola de sincronización, dashboard, notificaciones en tiempo real.

Detalle en [`plan.md`](plan.md), [`tasks.md`](tasks.md) y [`specs/`](specs/).

## Metodología y contribución

- **Scrum**, sprints de 1 semana, tareas en GitHub Projects vinculado a las issues.
- **Feature branching:** `feature/TASK-XX-breve-descripcion`; los cambios a `main` entran por Pull Request.
- TypeScript con `strict: true`, sin `any`.

Reglas completas en [`constitution.md`](constitution.md).
