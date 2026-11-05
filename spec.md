# Especificación: Plataforma de Gestión de Eventos NFC Offline-First

## 1. Visión General
Sistema integral (App móvil y Backend) para la gestión de eventos y festivales. El núcleo del sistema es el uso de pulseras NFC como identificador único para los asistentes, permitiendo el control de acceso, intercambio de contactos y gamificación, todo bajo una arquitectura que garantiza el funcionamiento sin conexión a internet (Offline-First).

## 2. Casos de Uso Principales (Core)
- **Acreditación y Vinculación NFC:** En la entrada, el organizador lee los datos del invitado desde la base de datos y los vincula a una pulsera NFC física.
- **Intercambio de Contactos (Lead Retrieval):** Los asistentes (o estands B2B) pueden escanear la pulsera de otro usuario para guardar instantáneamente su información de contacto en la app.
- **Gamificación de Estands ("Passport to Prizes"):** Puntos de lectura NFC en cada estand que otorgan "sellos" virtuales. Al acumular $X$ sellos, el sistema desbloquea recompensas para fomentar el engagement.
- **Control de Acceso y Aforo:** Restricción de zonas (ej. VIP, Staff) según el perfil del asistente. Medición de aforo en tiempo real por sala o taller.
- **Feedback de Estands:** Lectura NFC dedicada para valorar estands (1-5 estrellas), generando un ranking público en la app.

## 3. Requisitos No Funcionales Críticos
- **Modo de Operación Offline-First:** El recinto puede tener baja o nula conectividad. Las lecturas NFC y las modificaciones de estado se escriben en una base de datos local del dispositivo.
- **Sincronización en Segundo Plano:** Al recuperar conexión estable, el sistema debe sincronizar el estado local con el servidor central resolviendo posibles conflictos de datos.
- **Accesibilidad:** (Opcional/Fase Avanzada) Soporte para rutas accesibles y modos de alto contraste/daltonismo en los mapas interactivos.
