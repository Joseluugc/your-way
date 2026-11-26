-- Verificación de la Spec 06 (US-06.1) en Supabase: una fila por comprobación.
with tablas(orden, t) as (
  values (1,'users'),(2,'nfc_tags'),(3,'stands'),(4,'zones'),
         (5,'stamps'),(6,'ratings'),(7,'leads'),(8,'access_logs')
),
estructura as (
  select orden, t,
    exists (select 1 from information_schema.columns c
            where c.table_schema = 'public' and c.table_name = t and c.column_name = 'id'
              and c.data_type = 'uuid' and c.column_default like '%gen_random_uuid%')
    and exists (select 1 from pg_index i join pg_attribute a
                  on a.attrelid = i.indrelid and a.attnum = any(i.indkey)
                where i.indrelid = ('public.' || t)::regclass and i.indisprimary and a.attname = 'id') as id_uuid,
    (select count(*) from information_schema.columns c
      where c.table_schema = 'public' and c.table_name = t
        and c.column_name in ('created_at', 'updated_at', 'deleted_at')
        and c.data_type = 'timestamp with time zone') = 3 as auditoria,
    exists (select 1 from pg_trigger g
            where g.tgrelid = ('public.' || t)::regclass and g.tgname = 'trg_' || t || '_updated_at') as trigger_ok,
    exists (select 1 from pg_indexes i
            where i.schemaname = 'public' and i.tablename = t and i.indexname = 'idx_' || t || '_updated_at') as indice,
    (select relrowsecurity from pg_class where oid = ('public.' || t)::regclass) as rls,
    coalesce((select string_agg(p.cmd, ',' order by p.cmd) from pg_policies p
              where p.schemaname = 'public' and p.tablename = t), '') as policies
  from tablas
),
comprobaciones(orden, comprobacion, detalle, ok) as (
  select 0, 'migraciones 0001 · 0002 · 0003',
         concat_ws(' · ',
           case when exists (select 1 from information_schema.columns where table_name = 'eventos' and column_name = 'updated_at') then '0001 sí' else '0001 NO' end,
           case when exists (select 1 from information_schema.tables where table_name = 'user_stamps') then '0002 sí' else '0002 NO' end,
           case when exists (select 1 from information_schema.columns where table_name = 'nfc_tags' and column_name = 'id') then '0003 sí' else '0003 NO' end),
         exists (select 1 from information_schema.columns where table_name = 'eventos' and column_name = 'updated_at')
         and exists (select 1 from information_schema.tables where table_name = 'user_stamps')
         and exists (select 1 from information_schema.columns where table_name = 'nfc_tags' and column_name = 'id')
  union all
  select orden, 'tabla ' || t,
         coalesce(nullif(array_to_string(array_remove(array[
           case when not id_uuid then 'falta id UUID gen_random_uuid' end,
           case when not auditoria then 'faltan created_at/updated_at/deleted_at' end,
           case when not trigger_ok then 'falta trigger updated_at' end,
           case when not indice then 'falta índice updated_at' end,
           case when not rls then 'RLS desactivado' end,
           case when policies <> 'INSERT,SELECT,UPDATE' then 'policies: ' || policies end
         ], null), ' · '), ''), 'id UUID · auditoría · trigger · índice · RLS · ' || policies),
         id_uuid and auditoria and trigger_ok and indice and rls and policies = 'INSERT,SELECT,UPDATE'
  from estructura
  union all
  select 10, 'nfc_tags.uid único',
         case when exists (select 1 from pg_constraint where conrelid = 'public.nfc_tags'::regclass and contype = 'u' and conname = 'nfc_tags_uid_key') then 'UNIQUE (uid)' else 'falta UNIQUE (uid)' end,
         exists (select 1 from pg_constraint where conrelid = 'public.nfc_tags'::regclass and contype = 'u' and conname = 'nfc_tags_uid_key')
  union all
  select 11, 'stands.evento_id',
         case when exists (select 1 from information_schema.columns where table_name = 'stands' and column_name = 'evento_id') then 'existe' else 'NO existe' end,
         exists (select 1 from information_schema.columns where table_name = 'stands' and column_name = 'evento_id')
  union all
  select 12, 'seed: evento de la demo',
         (select count(*) from eventos where id = '00000000-0000-4000-8000-000000000001')::text || ' de 1',
         (select count(*) from eventos where id = '00000000-0000-4000-8000-000000000001') = 1
  union all
  select 13, 'seed: usuarios por rol',
         coalesce((select string_agg(role::text || '=' || n, ' · ' order by role::text)
                   from (select role, count(*) as n from users where id::text like 'd1%' group by role) r), 'ninguno'),
         (select count(*) from users where id::text like 'd1%' and role = 'ATTENDEE') = 5
         and (select count(*) from users where id::text like 'd1%' and role = 'VIP') = 2
         and (select count(*) from users where id::text like 'd1%' and role = 'STAFF') = 2
         and (select count(*) from users where id::text like 'd1%' and role = 'EXHIBITOR') = 1
  union all
  select 14, 'seed: zonas · estands · etiquetas NFC',
         concat_ws(' · ',
           (select count(*) from zones where id::text like 'd2%') || ' zonas',
           (select count(*) from stands where id::text like 'd3%') || ' estands',
           (select count(*) from nfc_tags where id::text like 'd4%') || ' etiquetas'),
         (select count(*) from zones where id::text like 'd2%') = 3
         and (select count(*) from stands where id::text like 'd3%') = 4
         and (select count(*) from nfc_tags where id::text like 'd4%') = 17
  union all
  select 15, 'datos que la app rechazaría al descargar',
         concat_ws(' · ',
           (select count(*) from stands where evento_id is null) || ' estands sin evento',
           (select count(*) from zones where required_role is null) || ' zonas sin rol',
           (select count(*) from access_logs where zone_id is null) || ' accesos sin zona'),
         (select count(*) from stands where evento_id is null) = 0
         and (select count(*) from zones where required_role is null) = 0
)
select comprobacion, detalle, ok from comprobaciones order by orden;
