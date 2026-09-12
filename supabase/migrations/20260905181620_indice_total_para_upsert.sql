-- Postgres no puede resolver ON CONFLICT contra un indice parcial, y PostgREST
-- usa ON CONFLICT cuando se envia Prefer: resolution=merge-duplicates.
-- El indice pasa a ser total. Como los tres campos son NOT NULL en la practica
-- (siempre hay client, click id y external_id), la clausula WHERE no aportaba.
drop index if exists uq_true_roas_dedupe;

alter table true_roas_events
  alter column client set not null,
  alter column gclid set not null,
  alter column external_id set not null;

create unique index uq_true_roas_dedupe
  on true_roas_events (client, gclid, external_id);;
