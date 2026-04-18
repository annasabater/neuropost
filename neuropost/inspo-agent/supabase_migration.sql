-- NeuroPost: tabla de pins de inspiración
-- Ejecuta en SQL Editor de tu Supabase

create table if not exists inspiration_pins (
  id              uuid default gen_random_uuid() primary key,
  pinterest_id    text unique not null,
  negocio         text not null,
  categoria       text not null,
  query           text not null,
  title           text,
  description     text,
  image_url       text,
  video_url       text,              -- URL del video si media_type = video
  pinterest_url   text,
  media_type      text default 'image',  -- 'image' | 'video'
  status          text default 'pending'
                  check (status in ('pending', 'approved', 'rejected')),
  telegram_msg_id bigint,
  created_at      timestamptz default now(),
  approved_at     timestamptz
);

create index if not exists idx_pins_status  on inspiration_pins(status);
create index if not exists idx_pins_negocio on inspiration_pins(negocio);
create index if not exists idx_pins_created on inspiration_pins(created_at desc);

alter table inspiration_pins enable row level security;

create policy "Service key full access"
  on inspiration_pins using (true) with check (true);

-- Vista para la web: solo aprobados
create or replace view approved_pins as
  select * from inspiration_pins
  where status = 'approved'
  order by approved_at desc;
