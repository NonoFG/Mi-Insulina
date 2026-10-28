begin;

-- Las fichas de usuario conservan una procedencia distinta de Open Food Facts.
alter table public.productos_escaneados
  drop constraint productos_escaneados_fuente_check,
  drop constraint productos_escaneados_registro_off_check,
  alter column fuente_url drop not null,
  alter column registro_off drop not null,
  add constraint productos_escaneados_procedencia_check check (
    (fuente = 'Open Food Facts' and fuente_url is not null
      and registro_off is not null and jsonb_typeof(registro_off) = 'object')
    or
    (fuente = 'Usuario (etiqueta; sin verificar)' and fuente_url is null
      and registro_off is null and carbs_100g is not null)
  );

-- Se mantienen RLS y los grants originales: los clientes solo pueden leer.
-- Las altas siguen entrando por guardar-producto con credenciales privadas.
commit;
