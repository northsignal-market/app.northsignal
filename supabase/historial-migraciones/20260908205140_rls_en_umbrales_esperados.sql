-- De las 94 tablas de public, 93 tienen RLS y cero politicas: con la clave anon no se
-- puede leer nada, que es como corresponde. La unica sin RLS era umbrales_esperados,
-- que cree yo hoy. Queda igual que las demas.
alter table public.umbrales_esperados enable row level security;;
