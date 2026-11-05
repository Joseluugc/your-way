# Hoja de Ruta del Proyecto

## Fase 1: Arquitectura Base y Entorno (Sprints 1-2)
- Inicialización del repositorio y configuración de flujos CI/CD.
- Setup de la aplicación móvil multiplataforma.
- Diseño del modelo de dominio (Entidades: Evento, Asistente, Pulsera, Estand, Sello).
- Configuración de la base de datos local y el motor de sincronización.

## Fase 2: Core NFC y Gestión Local (Sprints 3-4)
- Implementación de la librería de lectura/escritura NFC en la app.
- Flujo de vinculación de pulsera en puerta (Organizador -> Asistente).
- Flujo de intercambio de contactos entre asistentes (P2P offline).
- Guardado persistente en base de datos local.

## Fase 3: Gamificación y Control de Aforo (Sprints 5-6)
- Lógica de "Passport to Prizes" (adquisición de sellos por estand).
- Sistema de validación de permisos de acceso por zonas.
- Cálculo de aforo (entradas/salidas) por sala con almacenamiento de eventos de log temporales.

## Fase 4: Sincronización Backend y Analíticas (Sprints 7-8)
- Desarrollo del servidor central y API REST/GraphQL.
- Puesta en marcha de la cola de sincronización (resolución de conflictos eventual).
- Dashboard de estadísticas para organizadores (estands más valorados, aforo máximo).
- Notificaciones push o en tiempo real (Sockets) para actualizaciones del evento.
