create table public.productos_escaneados (
  id text primary key,
  codigo_barras text not null unique,
  nombre text not null check (length(btrim(nombre)) > 0),
  marca text,
  carbs_100g numeric check (carbs_100g is null or (carbs_100g >= 0 and carbs_100g <= 100)),
  grasas_100g numeric check (grasas_100g is null or (grasas_100g >= 0 and grasas_100g <= 100)),
  proteinas_100g numeric check (proteinas_100g is null or (proteinas_100g >= 0 and proteinas_100g <= 100)),
  unidad_cantidad text not null check (unidad_cantidad in ('g', 'ml')),
  cantidad_sugerida numeric check (cantidad_sugerida is null or cantidad_sugerida > 0),
  descripcion_cantidad text not null,
  fuente text not null check (fuente = 'Open Food Facts'),
  fuente_url text not null,
  consultado_en timestamptz not null,
  fecha_revision timestamptz,
  registro_off jsonb not null check (jsonb_typeof(registro_off) = 'object'),
  created_at timestamptz not null default now(),
  constraint productos_escaneados_id_barcode_match check (id = 'barcode:' || codigo_barras),
  constraint productos_escaneados_barcode_format check (codigo_barras ~ '^[0-9]{8}$|^[0-9]{12}$|^[0-9]{13}$|^[0-9]{14}$')
);

alter table public.productos_escaneados enable row level security;

revoke all on table public.productos_escaneados from public;
revoke all on table public.productos_escaneados from anon, authenticated, service_role;
grant select on table public.productos_escaneados to anon, authenticated;
grant select, insert on table public.productos_escaneados to service_role;

create policy "Public can read scanned products"
  on public.productos_escaneados
  for select
  to anon, authenticated
  using (true);

create policy "Service role can insert scanned products"
  on public.productos_escaneados
  for insert
  to service_role
  with check (true);
