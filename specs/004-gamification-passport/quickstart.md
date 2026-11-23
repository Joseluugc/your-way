# Quickstart: validar la Gamificación

Guía de validación de la feature `004-gamification-passport`. Para los detalles de datos y contratos, ver [data-model.md](data-model.md) y [contracts/](contracts/).

## Prerrequisitos

1. `app-eventos/.env.local` con `EXPO_PUBLIC_SUPABASE_URL` y `EXPO_PUBLIC_SUPABASE_KEY` (ver `.env.example`).
2. Migración remota aplicada: `supabase/migrations/0002_gamification.sql` (SQL Editor de Supabase o `supabase db push`).
3. Al menos un evento con facciones, estands con `zone_id`, una trivia por estand y `gamification_config` (el seed de dev los crea en local).
4. Dependencias instaladas: `cd app-eventos && npm install`.

## Comprobaciones automáticas (desde `app-eventos/`)

```bash
npm run test:domain   # incluye tests/gamification*.test.mjs
npx tsc --noEmit
npm run lint
```

Resultado esperado: todo en verde. Las suites cubren:
- **Dominio**: multiplicadores (1.0 / 1.5 / 2.0 / 3.0), trivia (acierto, fallo, timeout a los 15 s), las 4 insignias con sus valores límite (15 min, 5 valoraciones, zona completa, 3 sellos en 5 min exactos), media bayesiana (un 5 ★ no supera a 20 × 4.5 ★), cooldown de 20 min y distribución de la ruleta en 1 000 tiradas con semilla (±5 pp, SC-005).
- **Integración offline**: los casos de uso sobre SQLite real, sin remoto, cumplen los escenarios de aceptación de US1–US4. El reescaneo no genera filas nuevas (SC-006).
- **Sync**: remoto falso que falla a mitad de la subida; al reintentar, el remoto tiene exactamente las filas esperadas y la suma de XP no cambia (SC-003, SC-004).

## Escenarios manuales (app en Expo Go o development build)

Arranca con `npm start`. En `__DEV__` el pasaporte muestra un panel de simulación que publica `AttendeeWristbandWritten`, `StandNfcScanned` y `ZoneOccupancyChanged` en el bus.

| # | Pasos | Resultado esperado | Ref. |
|---|-------|--------------------|------|
| 1 | Modo avión → "Grabar pulsera" | El asistente queda en una facción visible en el pasaporte | US2-1 |
| 2 | Modo avión → escanear el estand A | Sello + vibración inmediata, trivia con cuenta atrás de 15 s; acertar → +150 XP en total; valorar 4 ★ → +25 XP | US1-1, 2, 4 |
| 3 | Escanear el estand A otra vez | «Ya visitado», se muestra 4 ★, el XP no cambia | US1-5 |
| 4 | Escanear el estand B y dejar agotar el tiempo | Sello conservado, 100 XP, sin bono | US1-3 |
| 5 | Simular que la zona del estand C pasa a `available` | Aviso de Misión Relámpago; escanear C → sello 200 XP | US2-3, 4 |
| 6 | Repetir el cambio de la zona de C antes de 20 min | Sin aviso nuevo; el ×2 se sigue aplicando | US2-5 |
| 7 | Tras el 3.er sello | Tirada disponible; girar → premio registrado + vibración | US3-1, 2 |
| 8 | Sellar 3 estands en < 5 min | Insignia `SPEEDRUNNER` (+250 XP) | US4-4 |
| 9 | Desactivar el modo avión | En Supabase, filas en `user_stamps`, `stand_ratings`, `xp_transactions`, … sin duplicados; `synced = 1` en local | SC-003 |
| 10 | Abrir Ranking | Estands ordenados por puntuación bayesiana y marcador de facciones con «Actualizado a las…» | US5 |

## Comprobación en Supabase

```sql
SELECT * FROM faction_scores WHERE evento_id = '<evento>';
SELECT * FROM stand_ranking  WHERE evento_id = '<evento>' ORDER BY bayesian_score DESC;
-- no debe devolver filas:
SELECT source_type, reference_id, COUNT(*) FROM xp_transactions GROUP BY 1, 2 HAVING COUNT(*) > 1;
```
