# Spec 03: Mapa, Aforo y Notificaciones

**Tarea:** TASK-07 — Spec 03 - Requisitos de Mapa, Aforo y Notificaciones  
**Owner:** @Rafa  
**Rama:** `Rafa`  
**Prioridad:** Alta  
**Puntos:** 2  
**Estado:** 🟢 En Desarrollo  
**Épica en GitHub Projects:** #Epic-03

## 1. Descripción Funcional

La aplicación móvil ofrece a los asistentes un plano 2D interactivo del recinto para localizar salas y estands, consultar fichas resumidas y conocer la ocupación de cada zona mediante un semáforo visual. También presenta avisos de la organización, cambios de horario y alertas de apertura o cierre de aforo mediante notificaciones y mensajes dentro de la aplicación.

El mapa base y las coordenadas de los estands se conservan localmente para que el plano siga disponible sin conexión. Cuando no haya red, la aplicación indica cuándo se actualizaron por última vez los datos de aforo y no presenta datos antiguos como si fueran actuales.

## 2. Historias de Usuario (Tickets para el Sprint)

### [US-03.1] Consultar e interactuar con el mapa del recinto
- **Como** asistente
- **Quiero** explorar un plano 2D y seleccionar una sala o un estand
- **Para** orientarme en el recinto y consultar información resumida de sus espacios

**Criterios de Aceptación (Definition of Done):**
- [ ] El plano se renderiza como elementos vectoriales con `react-native-svg` e identifica las salas a partir de `zones` y los estands a partir de `stands`.
- [ ] Cada marcador de estand se posiciona usando sus coordenadas `map_x` y `map_y`; las coordenadas se transforman de forma consistente al aplicar zoom o desplazamiento.
- [ ] El usuario puede ampliar, reducir y desplazar el plano sin que los marcadores pierdan su correspondencia con la ubicación representada.
- [ ] Al pulsar una sala o un estand, se muestra una ficha resumen asociada al elemento seleccionado, incluyendo como mínimo su nombre. La ficha de una sala incluye también su estado de aforo cuando haya datos disponibles.
- [ ] Los elementos seleccionables ofrecen un área de interacción accesible y no dependen exclusivamente del color para comunicar su identidad.
- [ ] Si el mapa o sus elementos aún no se han descargado, se muestra un estado vacío o de carga comprensible, sin bloquear el resto de la aplicación.

### [US-03.2] Consultar el semáforo de aforo por zona
- **Como** asistente
- **Quiero** ver el nivel de ocupación de cada sala en el mapa
- **Para** elegir una zona disponible y evitar espacios completos

**Criterios de Aceptación (Definition of Done):**
- [ ] Para cada `zone`, la ocupación se calcula a partir de sus `access_logs` aplicando `ENTRY` como +1 y `EXIT` como -1, en orden temporal y sin mezclar registros de otras zonas.
- [ ] El porcentaje se calcula como `current_capacity / max_capacity * 100`, usando la ocupación derivada de los registros disponibles; el valor mostrado y el color se actualizan cuando cambia la información de aforo.
- [ ] El marcador es verde cuando la ocupación es inferior al 70 %, naranja desde el 70 % y hasta antes del 95 %, y rojo a partir del 95 % inclusive.
- [ ] Los valores límite se clasifican correctamente: 69 % es verde, 70 % y 94 % son naranja, y 95 % es rojo.
- [ ] Un dato de capacidad inválido o ausente, incluidos `max_capacity` igual a cero o inferior, se representa como aforo no disponible; nunca se clasifica como zona verde.
- [ ] El porcentaje o cantidad de ocupación y su estado se comunican también con texto o una etiqueta accesible; el color no es el único indicador.
- [ ] La interfaz distingue datos en tiempo real de los datos en caché y muestra la última marca temporal de actualización cuando la información no esté sincronizada.

### [US-03.3] Recibir notificaciones y alertas del evento
- **Como** asistente
- **Quiero** recibir avisos de la organización, cambios de horario y alertas de aforo
- **Para** estar informado de cambios relevantes durante el evento

**Criterios de Aceptación (Definition of Done):**
- [ ] La aplicación presenta avisos de la organización, cambios en el cronograma de salas y eventos de apertura o cierre de aforo recibidos desde el servicio del evento.
- [ ] Cuando la aplicación está abierta, los avisos nuevos se muestran mediante una notificación o pop-up in-app sin requerir que el usuario navegue a otra pantalla.
- [ ] Cuando la aplicación está en segundo plano y el sistema y los permisos lo permiten, los avisos se entregan mediante notificación local o push, según el canal disponible.
- [ ] La solicitud de permisos de notificación explica su finalidad; si el usuario los deniega, la aplicación mantiene disponibles los avisos in-app y comunica que las notificaciones del sistema están desactivadas.
- [ ] Cada aviso identifica su tipo, contenido y momento de recepción, y los cambios de horario o aforo indican la sala afectada cuando corresponda.
- [ ] Si no hay conexión, los avisos previamente recibidos y guardados siguen consultables; la aplicación no simula la recepción de avisos nuevos mientras está desconectada.

### [US-03.4] Usar el plano y consultar aforo sin conexión
- **Como** asistente en un recinto con conectividad limitada
- **Quiero** consultar el plano y las ubicaciones guardadas sin conexión
- **Para** orientarme aunque no tenga acceso a la red

**Criterios de Aceptación (Definition of Done):**
- [ ] El plano base, los identificadores y nombres de zonas y estands, y las coordenadas de los estands se guardan en la base de datos local SQLite y se pueden consultar tras reiniciar la aplicación.
- [ ] Sin conexión, el mapa y las fichas de elementos ya almacenados siguen disponibles y permiten zoom, desplazamiento y selección.
- [ ] El aforo sin conexión se presenta como el último dato conocido y muestra de forma visible su fecha y hora de actualización; no se etiqueta como dato en tiempo real.
- [ ] La falta de red no impide abrir el mapa ni consultar sus datos locales; los controles dependientes del servidor muestran un estado sin conexión comprensible.
- [ ] Al recuperar la conectividad, los datos nuevos del plano y del aforo pueden sincronizarse con la fuente remota y la marca temporal se actualiza al persistir correctamente la nueva información.

## 3. Consideraciones Técnicas

- **Tablas implicadas:** `stands` (`id`, `name`, `owner_id`, `map_x`, `map_y`), `zones` (`id`, `name`, `max_capacity`, `current_capacity`, `required_role`) y `access_logs` (`id`, `user_id`, `zone_id`, `action`, `timestamp`). Las claves de entidad son UUID v4.
- **Tecnologías/Librerías:** React Native, Expo, TypeScript con `strict: true`, `react-native-svg` para el plano vectorial, SQLite/WatermelonDB para persistencia local y un mecanismo de conectividad como Expo Network o NetInfo. Las notificaciones deberán integrarse con el canal local/push compatible con Expo y con el servicio backend Node.js/PostgreSQL.
- **Aforo:** La ocupación se deriva de la secuencia de entradas y salidas de `access_logs` por zona. `zones.current_capacity` existe en el esquema y puede servir como valor sincronizado o de comparación, pero la regla de clasificación indicada en esta spec debe usar los eventos de acceso disponibles. La API y la sincronización deben acordar cómo evitar dobles conteos y cómo resolver registros recibidos fuera de orden.
- **Mapa:** El esquema actual proporciona coordenadas puntuales de estands, pero no define geometría, dimensiones ni coordenadas de contorno para dibujar salas. La implementación debe acordar el formato de geometría de `zones` y el sistema de referencia del plano antes de representar sus límites; hasta entonces, la selección y el marcador de una sala deben apoyarse en los datos de zona disponibles, sin inventar polígonos.
- **Notificaciones y cronograma:** El esquema SQL actual no contiene tablas para notificaciones ni para sesiones o cambios de cronograma. El backend debe proporcionar un contrato de eventos que incluya identificador, tipo, contenido, sala relacionada si aplica y fecha/hora, además de reglas de entrega y persistencia. No se debe inferir ni almacenar este contenido en una tabla existente sin definir el contrato.
- **Manejo Offline:** SQLite es la fuente de lectura local del mapa y de los últimos datos sincronizados. Cada conjunto de datos de aforo debe conservar su marca temporal de actualización. Las nuevas lecturas de aforo y notificaciones se incorporan al recuperar conectividad; mientras tanto, la interfaz informa de su antigüedad y no muestra valores obsoletos como actuales.
