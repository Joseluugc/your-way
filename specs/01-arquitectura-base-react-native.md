# Spec 01: Arquitectura Base de React Native, Inicialización de Base de Datos Local y Dashboard de Estadísticas del Organizador

**Owner:** @joseluu.gc
**Estado:** 🟢 En Desarrollo
**Épica en GitHub Projects:** #Epic-01

## 1. Descripción Funcional
Establecer la base de la aplicación móvil en React Native, incluyendo su estructura inicial, la creación y evolución versionada de una base de datos SQLite local y un dashboard de solo lectura para el organizador. El dashboard presentará estadísticas del evento a partir de los datos disponibles localmente: asistentes, actividad en stands, valoraciones, contactos intercambiados y ocupación de zonas. La aplicación deberá iniciar y permitir consultar los últimos datos sincronizados aunque no haya conexión.

## 2. Historias de Usuario (Tickets para el Sprint)

### [US-01.1] Inicializar la aplicación React Native y la base de datos local
- **Como** desarrollador del proyecto
- **Quiero** iniciar la aplicación con una arquitectura organizada y una base SQLite inicializada mediante migraciones
- **Para** disponer de una base mantenible que persista los datos necesarios para las funcionalidades del evento

**Criterios de Aceptación (Definition of Done):**
- [ ] La aplicación arranca en iOS y Android y separa presentación, lógica de negocio y acceso a datos.
- [ ] La inicialización crea la base local de forma segura en el primer arranque y aplica migraciones versionadas sin borrar datos existentes al actualizar.
- [ ] El esquema local contempla las entidades requeridas de `users`, `stands`, `zones`, `nfc_tags`, `stamps`, `ratings`, `leads` y `access_logs`, conservando sus relaciones, restricciones y valores válidos.
- [ ] La aplicación puede abrirse sin conexión y conserva los datos locales entre reinicios.

### [US-01.2] Consultar el dashboard de estadísticas del organizador
- **Como** organizador autorizado
- **Quiero** consultar un resumen de asistencia y actividad del evento
- **Para** conocer la participación, el rendimiento de los stands y el estado de ocupación de las zonas

**Criterios de Aceptación (Definition of Done):**
- [ ] El dashboard muestra el total de asistentes registrados, el número de sellos por stand, la valoración media por stand, el total de leads y la ocupación actual por zona respecto a su capacidad máxima.
- [ ] Las métricas se calculan desde las tablas correspondientes (`users`, `stamps`, `ratings`, `leads` y `zones`) y los resultados vacíos se presentan como cero o sin valoración, sin provocar errores.
- [ ] El dashboard indica cuándo se actualizaron por última vez los datos disponibles y permite mostrar los datos locales cuando no hay conexión.
- [ ] El acceso al dashboard queda restringido al perfil autorizado; mientras el esquema no incluya un rol `ORGANIZER`, se usa `STAFF` como rol organizador.

### [US-01.3] Consultar estadísticas a partir de datos sincronizados
- **Como** organizador autorizado
- **Quiero** que las estadísticas se actualicen al recuperar la conexión
- **Para** tomar decisiones con datos recientes sin perder el acceso al último resumen disponible durante una desconexión

**Criterios de Aceptación (Definition of Done):**
- [ ] Cuando existe conexión, la aplicación actualiza los datos locales disponibles y el dashboard vuelve a calcular sus métricas tras completar la actualización.
- [ ] Si la actualización falla o no hay conexión, los datos previamente almacenados siguen disponibles y se informa de que no están actualizados.
- [ ] Una actualización interrumpida no deja la base local en un estado parcial o inconsistente.

## 3. Consideraciones Técnicas
- **Tablas implicadas:** `users`, `stands`, `zones`, `nfc_tags`, `stamps`, `ratings`, `leads`, `access_logs`.
- **Tecnologías/Librerías:** React Native, TypeScript, SQLite mediante `expo-sqlite` o una alternativa equivalente, migraciones de esquema y NetInfo para detectar conectividad.
- **Manejo Offline:** La base SQLite es la fuente de lectura local del dashboard. Se conserva la última actualización disponible; al no haber conexión o fallar una actualización, la app sigue funcionando con esos datos e indica su antigüedad. La sincronización debe aplicar los cambios de forma transaccional. La conversión del esquema PostgreSQL a SQLite debe preservar UUID, relaciones, valores enumerados, unicidad de `stamps(user_id, stand_id)` y la restricción de puntuación de `ratings.score`.