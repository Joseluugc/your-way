# Project Constitution: NFC Event App

## Tech Stack
- Frontend/Mobile: React Native, TypeScript, React Navigation, Android Studio
- Local Database: Supabase.
- State Management: Context API / Redux.
- Architecture: MVC (Model-View-Controller).

## Core Rules
1. **Offline-First:** Todas las lecturas/escrituras deben hacerse primero en la base de datos local. La sincronización con el backend debe ocurrir en segundo plano cuando haya conexión.
2. **Strict Typing:** TypeScript estricto. No se permiten `any`. Las interfaces para el modelo de datos (Asistentes, Stands, Sellos) deben estar claramente definidas en la capa Model.
3. **Hardware Handling:** Los errores de lectura/escritura del hardware NFC deben capturarse y mostrar un feedback claro en la interfaz (View).
4. **Clean Code:** Aplicar principios SOLID. La lógica de negocio (asignación de puntos, validación de acceso) debe estar separada de los componentes visuales.
