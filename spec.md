# Specification: Event Management Platform

## Overview
App para gestión de eventos donde los invitados interactúan mediante pulseras NFC. Permite el intercambio de contactos P2P, gamificación en stands y control de aforos.

## Core Features
1. **Acceso e Identificación:** Vinculación de pulsera NFC con perfil de usuario en la entrada. Control de acceso por zonas (roles/perfiles).
2. **Networking (Lead Retrieval):** Lectura P2P de pulseras para intercambiar y guardar contactos en la app. Opciones B2B para que los stands capturen leads.
3. **Mapa Interactivo y Aforo:** Mapa del evento con control de aforo en tiempo real por sala. Notificaciones push geolocalizadas. Rutas de accesibilidad (sillas de ruedas, daltonismo).
4. **Gamificación ("Passport to Prizes"):** Lectura NFC en stands para obtener sellos. Sistema de recompensas al alcanzar X sellos.
5. **Valoración y Estadísticas:** Rating de stands vía NFC, leaderboards públicos en la app y analíticas para organizadores.
6. **Modo Offline:** Funcionamiento garantizado sin internet. Base de datos local con sincronización en segundo plano al recuperar red.
