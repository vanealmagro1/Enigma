-- ULTRA: buzón de mensajes interceptados.
-- Pégalo en Supabase → SQL Editor → New query → Run.

create table if not exists public.mensajes (
  id      bigint generated always as identity primary key,
  -- Solo letras A–Z: es lo único que produce la Enigma. El largo evita basura y abusos.
  cifrado text not null check (cifrado ~ '^[A-Z]+$' and char_length(cifrado) between 10 and 300),
  creado  timestamptz not null default now()
);

alter table public.mensajes enable row level security;

-- Cualquiera con el link puede transmitir (insertar) y la pantalla puede leer lo reciente.
-- Nadie puede editar ni borrar desde la web.
drop policy if exists "transmitir" on public.mensajes;
create policy "transmitir" on public.mensajes for insert to anon with check (true);

-- Solo se pueden leer los mensajes de los últimos 15 minutos: la pantalla solo necesita el último,
-- y así los mensajes viejos de los visitantes no quedan a la vista de cualquiera.
drop policy if exists "leer" on public.mensajes;
create policy "leer" on public.mensajes for select to anon
  using (creado > now() - interval '15 minutes');

grant select, insert on public.mensajes to anon;
