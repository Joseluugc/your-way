# Spec 01: Arquitectura Base de React Native, Inicialización de Base de Datos Local y Dashboard de Estadísticas del Organizador

**Owner:** @joseluu.gc
**Estado:** 🟢 En Desarrollo
**Épica en GitHub Projects:** #Epic-01

## 1. Descripción Funcional
Establecer la aplicación móvil multiplataforma con React Native, Expo y TypeScript estricto, su arquitectura base y la persistencia SQLite offline-first. La lógica de dominio se mantendrá independiente de React Native mediante arquitectura hexagonal y principios DDD, separando la interfaz de usuario de la persistencia. La spec incluye un dashboard de solo lectura para el organizador que resume los datos del evento disponibles localmente: usuarios por rol, sellos y valoraciones por stand, leads y ocupación por zona. La sincronización con el backend Node.js/PostgreSQL pertenece a una fase posterior; el funcionamiento local no dependerá de ella.

## 2. Historias de Usuario (Tickets para el Sprint)

### [US-01.1] Inicializar la aplicación móvil y su arquitectura
- **Como** desarrollador del proyecto
- **Quiero** iniciar una aplicación Expo con React Native y TypeScript estricto, organizada por responsabilidades
- **Para** disponer de una base multiplataforma mantenible cuya lógica de dominio pueda probarse sin depender de la interfaz

**Criterios de Aceptación (Definition of Done):**
- [ ] El proyecto usa React Native, Expo y TypeScript con `strict: true`; no introduce tipos `any`.
- [ ] La estructura separa presentación, dominio y adaptadores de infraestructura, y aplica arquitectura hexagonal/DDD a la lógica de negocio.
- [ ] La interfaz y los hooks de persistencia quedan separados mediante una organización tipo Presenter o MVC.
- [ ] La aplicación puede iniciarse en iOS y Android y la lógica de dominio no depende de APIs de React Native.

### [US-01.2] Inicializar y persistir el modelo local
- **Como** desarrollador del proyecto
- **Quiero** crear y evolucionar una base SQLite local para el modelo del evento
- **Para** que las funciones principales puedan operar sin conexión y conservar sus datos en el dispositivo

**Criterios de Aceptación (Definition of Done):**
- [ ] La base local se inicializa de forma idempotente y conserva los datos entre reinicios de la aplicación.
- [ ] El modelo local contempla `users`, `stands`, `zones`, `nfc_tags`, `stamps`, `ratings`, `leads` y `access_logs`, con sus relaciones, roles, tipos y restricciones definidos en el esquema.
- [ ] Se preservan, como mínimo, la unicidad de `users.email` y de `(user_id, stand_id)` en `stamps`, la puntuación de `ratings.score` entre 1 y 5 y los valores válidos de los enums.
- [ ] Las operaciones locales de escritura se ejecutan de forma consistente y la aplicación puede consultar los datos persistidos sin conexión.

### [US-01.3] Consultar el dashboard de estadísticas del organizador
- **Como** organizador autorizado
- **Quiero** consultar un resumen de asistencia y actividad del evento
- **Para** conocer la participación, el rendimiento de los stands y el estado de ocupación de las zonas

**Criterios de Aceptación (Definition of Done):**
- [ ] El dashboard muestra el total de usuarios desglosado por rol, los sellos por stand, la valoración media por stand, el total de leads y la ocupación por zona respecto a `max_capacity`.
- [ ] Las métricas se calculan desde `users`, `stamps`, `ratings`, `leads` y `zones`; las colecciones vacías se representan sin errores, con cero o sin valoración según corresponda.
- [ ] El dashboard consulta la información local disponible y presenta un estado vacío cuando todavía no hay datos; no requiere conexión para leer los datos persistidos.
- [ ] El dashboard solo se muestra dentro del flujo autorizado para organizadores. El esquema actual no define el rol `ORGANIZER`; se deberá acordar si `STAFF` representa temporalmente ese acceso o si se amplía el modelo antes de implementar autorización.

## 3. Consideraciones Técnicas
- **Tablas implicadas:** `users`, `stands`, `zones`, `nfc_tags`, `stamps`, `ratings`, `leads`, `access_logs`.
- **Tecnologías/Librerías:** React Native, Expo, TypeScript estricto, SQLite y `react-native-nfc-manager` según la pila acordada. WatermelonDB y PowerSync son alternativas recomendadas por la Constitución para la capa local; la elección entre ellas queda pendiente. El backend futuro será Node.js con PostgreSQL. React Navigation aparece en las tareas de la Fase 1 para la navegación móvil.
- **Manejo Offline:** La persistencia local debe permitir consultar y conservar los datos sin conexión antes de desarrollar la sincronización en la nube. El dashboard muestra los datos existentes en el dispositivo y un estado vacío si todavía no se han cargado; la sincronización y la frescura respecto al servidor se concretarán en la fase de backend. La adaptación del esquema PostgreSQL a SQLite debe mantener las relaciones, roles, tipos y restricciones que sean aplicables.  