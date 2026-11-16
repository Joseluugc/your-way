# Spec 05: Módulo B2B, Leads y Control de Accesos

**Owner:** @raul
**Estado:** 🔵 To Do
**Épica:** #Epic-5

## 1. Descripción Funcional
Este módulo gestiona la capa de negocio y seguridad del evento. Permite el intercambio rápido de información de contacto entre asistentes (Networking B2B) mediante la lectura de pulseras NFC. Además, provee a los organizadores de una interfaz para validar los permisos de entrada a zonas restringidas (ej. VIP, Staff) escaneando las pulseras en las puertas.

## 2. Historias de Usuario

### [US-5.1] Intercambio de Contactos P2P (Leads B2B)
- **Como** asistente o expositor.
- **Quiero** escanear la pulsera NFC de otro asistente con mi móvil.
- **Para** guardar automáticamente sus datos (nombre, empresa, LinkedIn) en mi lista de contactos.

**Criterios de Aceptación:**
- [ ] Botón en la interfaz para iniciar modo "Lectura Networking".
- [ ] Lectura del UUID del NFC y recuperación de los datos del usuario escaneado desde la base de datos local.
- [ ] Feedback háptico (vibración) corto y confirmación visual al capturar el contacto.
- [ ] Creación de un registro en la tabla `leads` vinculando al usuario que escanea y al escaneado.

### [US-5.2] Control de Accesos y Permisos
- **Como** staff de seguridad.
- **Quiero** escanear la pulsera de un asistente en la puerta de una sala.
- **Para** saber inmediatamente si tiene permisos para entrar.

**Criterios de Aceptación:**
- [ ] Menú para seleccionar en qué `zone` se está realizando el control.
- [ ] Lógica que compara el `role` del usuario escaneado con el `required_role` de la zona seleccionada.
- [ ] Pantalla verde completa (éxito) si el acceso es válido.
- [ ] Pantalla roja completa (rechazo) con vibración de error si no tiene permisos.
- [ ] Registro automático de la acción ('ENTRY') en la tabla `access_logs`.

## 3. Consideraciones Técnicas
- **Offline-First:** Las lecturas y validaciones operarán contra la base de datos local (SQLite) para garantizar el funcionamiento sin conexión.
- **Sincronización:** Las nuevas filas generadas en `leads` y `access_logs` se insertarán con el flag de sincronización en `false` para que el módulo de Supabase las suba posteriormente.
