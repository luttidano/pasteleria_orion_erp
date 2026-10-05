-- =============================================================================
-- PASTELERÍA ORIÓN ERP — SCRIPT DE CONFIGURACIÓN PARA SUPABASE
-- =============================================================================
-- Ejecuta este script en el SQL Editor de tu proyecto en Supabase
-- (https://supabase.com/dashboard/project/_/sql)
-- =============================================================================

-- 1. TABLA DE PERFILES DE USUARIO (public.profiles)
-- Extiende auth.users con metadatos de la aplicación y roles ('admin' o 'user')
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  email text,
  role text not null default 'user' check (role in ('admin', 'user')),
  avatar_url text, -- URL pública en Cloudflare R2 / CDN
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Habilitar RLS en profiles
alter table public.profiles enable row level security;

-- Políticas de seguridad para profiles
create policy "Los usuarios autenticados pueden ver su propio perfil"
  on public.profiles for select
  to authenticated
  using (auth.uid() = id);

create policy "Los administradores pueden ver todos los perfiles"
  on public.profiles for select
  to authenticated
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );

create policy "Los usuarios pueden actualizar su propio perfil"
  on public.profiles for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

create policy "Permitir inserción de perfil al registrarse"
  on public.profiles for insert
  to authenticated
  with check (auth.uid() = id);

-- 2. TRIGGER AUTOMÁTICO PARA CREAR PERFIL AL REGISTRAR EN AUTH.USERS
-- Cuando un usuario se registra vía Supabase Auth, se crea automáticamente su perfil
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, name, email, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    new.email,
    case
      when new.email = 'admin@pasteleriaorion.com' then 'admin'
      else coalesce(new.raw_user_meta_data->>'role', 'user')
    end
  )
  on conflict (id) do update set
    name = excluded.name,
    email = excluded.email;
  return new;
end;
$$ language plpgsql security definer;

-- Registrar el trigger en auth.users
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- 3. TABLA DE MATERIAS PRIMAS / INGREDIENTES (public.ingredients)
create table if not exists public.ingredients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text not null,
  stock numeric not null default 0,
  min_stock numeric not null default 0,
  unit text not null default 'kg',
  price numeric default 0,
  icon text, -- Emoji o icono ligero (ej: 🌾, 🧈, 🍫)
  image_url text, -- URL pública en Cloudflare R2 (cero almacenamiento de archivos pesados en Supabase)
  description text,
  status text not null default 'suficiente' check (status in ('suficiente', 'bajo', 'agotado')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Habilitar RLS en ingredients
alter table public.ingredients enable row level security;

-- Cualquier usuario autenticado puede consultar los ingredientes
create policy "Cualquier usuario autenticado puede leer ingredientes"
  on public.ingredients for select
  to authenticated
  using (true);

-- Solo usuarios administradores pueden crear, modificar o eliminar ingredientes
create policy "Solo administradores pueden crear ingredientes"
  on public.ingredients for insert
  to authenticated
  with check (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );

create policy "Solo administradores pueden modificar ingredientes"
  on public.ingredients for update
  to authenticated
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );

create policy "Solo administradores pueden eliminar ingredientes"
  on public.ingredients for delete
  to authenticated
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );

-- 4. COMANDO ÚTIL PARA ASIGNAR ROL DE ADMINISTRADOR MANUALMENTE (Opcional):
-- update public.profiles set role = 'admin' where email = 'tu_correo@dominio.com';

