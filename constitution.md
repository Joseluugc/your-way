# Constitución del Proyecto (Reglas y Acuerdos)

## 1. Pila Tecnológica (Tech Stack)
- **Frontend / App Móvil:** React Native, Expo, TypeScript.
- **Lectura NFC:** `react-native-nfc-manager`.
- **Almacenamiento Local:** SQLite (recomendado uso de WatermelonDB o PowerSync por su manejo nativo de reactividad y sincronización offline).
- **Backend (Futuro):** Node.js, PostgreSQL.

## 2. Metodología y Organización
- **Marco de Trabajo:** Scrum.
- **Duración del Sprint:** 1 semanas.
- **Gestión de Tareas:** GitHub Projects vinculado a las issues del repositorio.
- **Asignación:** Las tareas de cada Sprint Backlog deben estar estimadas en puntos de historia o tiempo relativo antes de iniciar el Sprint.

## 3. Arquitectura y Código
- **Patrones de Diseño:** Se priorizará el uso de Arquitectura Hexagonal y Domain-Driven Design (DDD). La lógica de negocio (reglas de gamificación, control de aforo) debe ser agnóstica a React Native.
- **Tipado:** TypeScript estricto (`"strict": true` en `tsconfig.json`). No se permiten `any`.
- **Control de Versiones:** Flujo basado en Ramas de Funcionalidad (Feature Branching). 
  - Nomenclatura: `feature/TASK-XX-breve-descripcion`.
  - Las integraciones a `main` requieren Pull Request.

## 4. Compromisos de Calidad
- El código debe ser funcional en modo offline antes de desarrollar la sincronización en la nube.
- Componentes de UI separados lógicamente de los hooks de persistencia de datos (uso del patrón Model-View-Controller o Presenter).
