-- Prueba de RLS: actúa como un usuario con sesión (rol authenticated), como la app.
-- El borrado debe afectar a 0 filas: no hay policy de DELETE (borrado lógico).
set local role authenticated;
with borrado as (
  delete from zones where id = 'd2000000-0000-4000-8000-000000000003' returning id
)
select current_user as rol,
       (select count(*) from zones where id::text like 'd2%') as zonas_que_ve,
       (select count(*) from borrado) as filas_borradas;
