-- Ticket 12: la extraccion no traia top_impr_share ni abs_top_impr_share a nivel
-- grupo ni keyword, y sin la cuota de primera posicion del grupo de marca no se
-- puede separar una caida de tasa por posicion de una por sitio o medicion.
-- El script semanal v12 (ambas copias) ya exporta estas columnas; quedan NULL en
-- las semanas anteriores al primer lunes que corra con v12 (2026-09-14): eso es
-- "no medido", no cero.
alter table adgroup
  add column if not exists top_impr_share numeric,
  add column if not exists abs_top_impr_share numeric;

alter table keywords
  add column if not exists abs_top_impr_share numeric;
