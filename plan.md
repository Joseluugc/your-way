# Technical Plan

## 1. Data Models (Local & Remote)
- `User`: id, name, company, nfc_tag_id, role, contact_info.
- `Connection`: user_id, met_user_id, timestamp.
- `Stand`: id, name, location_x, location_y, current_rating.
- `Stamp`: user_id, stand_id, timestamp.
- `Room`: id, name, max_capacity, current_capacity.

## 2. Core Services (Controllers)
- `NfcController`: Wrapper para `react-native-nfc-manager`. Maneja lectura (NDEF) y escritura.
- `SyncManager`: Hilo en segundo plano que compara el timestamp de la BBDD local con el servidor. Sube `Connections` y `Stamps` pendientes; baja actualizaciones de `Room` (aforo).
- `MapEngine`: Renderizado del mapa en SVG o canvas, inyectando datos de aforo en tiempo real y aplicando filtros de accesibilidad.

## 3. UI/Views
- Pantalla principal (Dashboard/Mapa).
- Pantalla de Escáner NFC.
- Libreta de contactos (Networking).
- Perfil / Pasaporte de gamificación.
