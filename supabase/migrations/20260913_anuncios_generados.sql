-- PENDIENTE DE APLICAR (13/9/2026). El clasificador del entorno bloqueó tanto
-- apply_migration como execute_sql en la sesión que escribió el historial del
-- RSA Factory, así que esta tabla NO está creada todavía.
--
-- Para aplicarla, desde el SQL editor de Supabase o con el CLI:
--     supabase db push
--
-- Mientras no exista, /api/rsa/historial responde 200 con {disponible:false} y
-- la pantalla lo dice: el anuncio se genera igual, lo que falta es el rastro.
--
-- Por qué existe: el RSA Factory escribía anuncios que vivian solo en la
-- pantalla. Al cerrar la pestaña no quedaba registro de que se genero, con que
-- contexto ni si se termino usando. Un anuncio generado sin rastro no se puede
-- auditar ni aprender de el.
create table if not exists anuncios_generados (
  id bigint generated always as identity primary key,
  account text not null,
  campaign text not null,
  ad_group text not null,
  titulos text[] not null,
  descripciones text[] not null,
  diagnostico jsonb,
  generado_el timestamptz not null default now(),
  -- borrador: se genero y nada mas. copiado: se lo llevaron a Google Ads.
  -- publicado: confirmado arriba. descartado: no servia (eso tambien ensena).
  estado text not null default 'borrador'
    check (estado in ('borrador', 'copiado', 'publicado', 'descartado')),
  nota text
);

create index if not exists anuncios_generados_cuenta_fecha
  on anuncios_generados (account, generado_el desc);

comment on table anuncios_generados is
  'Historial de anuncios escritos por el RSA Factory: que se genero, para que grupo, con que diagnostico y en que termino.';
comment on column anuncios_generados.estado is
  'borrador -> copiado -> publicado. descartado si no servia.';
