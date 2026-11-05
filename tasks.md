# Product Backlog (Fase 1)

## Épica 1: Configuración de Entorno e Infraestructura Móvil
- [ ] **TASK-01:** Inicializar proyecto React Native con TypeScript.
- [ ] **TASK-02:** Configurar linters (ESLint, Prettier) y convenciones de código.
- [ ] **TASK-03:** Instalar y configurar `react-native-nfc-manager` para iOS y Android.
- [ ] **TASK-04:** Configurar base de datos local orientada a offline-first (ej. SQLite / WatermelonDB).

## Épica 2: Modelado de Dominio y Lógica Base
- [ ] **TASK-05:** Definir interfaces TypeScript para `User`, `Event`, `NfcTag` y `Stand`.
- [ ] **TASK-06:** Implementar el repositorio local (Patrón Repository) para operaciones CRUD de usuarios.
- [ ] **TASK-07:** Crear pantalla básica de "Escáner NFC" que imprima el UID de la pulsera en consola.
- [ ] **TASK-08:** Crear pantalla de vinculación (Mock UI) para asociar un UID a un User dummy.

## Épica 3: Interfaz de Usuario y Navegación
- [ ] **TASK-09:** Configurar React Navigation (Tab Navigator para mapa, contactos, perfil).
- [ ] **TASK-10:** Crear componente de Mapa interactivo (placeholder estático inicial).
