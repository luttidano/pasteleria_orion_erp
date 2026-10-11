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

-- 2. FUNCIÓN AUXILIAR SECURITY DEFINER: is_admin()
-- IMPORTANTE: Definir con 'security definer' evita la recursión infinita (error 42P17)
-- en las políticas de RLS al consultar la tabla profiles.
create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(
    (select role = 'admin' from public.profiles where id = auth.uid()),
    false
  );
$$;

-- Políticas de seguridad para profiles (Eliminamos las anteriores para evitar conflictos)
drop policy if exists "Los usuarios autenticados pueden ver su propio perfil" on public.profiles;
drop policy if exists "Los administradores pueden ver todos los perfiles" on public.profiles;
drop policy if exists "Los usuarios pueden ver su propio perfil o administradores ver todos" on public.profiles;
drop policy if exists "Los usuarios pueden actualizar su propio perfil" on public.profiles;
drop policy if exists "Permitir inserción de perfil al registrarse" on public.profiles;

-- Política de lectura de perfiles sin recursión
create policy "Los usuarios pueden ver su propio perfil o administradores ver todos"
  on public.profiles for select
  to authenticated
  using (auth.uid() = id or public.is_admin());

create policy "Los usuarios pueden actualizar su propio perfil"
  on public.profiles for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

create policy "Permitir inserción de perfil al registrarse"
  on public.profiles for insert
  to authenticated
  with check (auth.uid() = id);


-- 3. TRIGGER AUTOMÁTICO PARA CREAR PERFIL AL REGISTRAR EN AUTH.USERS
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
      when new.email = 'admin@pasteleriaorion.com'
        or new.email like 'admin@%'
        or coalesce(new.raw_user_meta_data->>'role', '') = 'admin' then 'admin'
      else coalesce(new.raw_user_meta_data->>'role', 'user')
    end
  )
  on conflict (id) do update set
    name = excluded.name,
    email = excluded.email,
    role = case
      when excluded.role = 'admin' or public.profiles.role = 'admin' then 'admin'
      else excluded.role
    end;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

-- Registrar el trigger en auth.users
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();


-- 4. TABLA DE MATERIAS PRIMAS / INGREDIENTES (public.ingredients)
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

-- Eliminar políticas antiguas para reemplazarlas por las corregidas sin recursión
drop policy if exists "Cualquier usuario autenticado puede leer ingredientes" on public.ingredients;
drop policy if exists "Solo administradores pueden crear ingredientes" on public.ingredients;
drop policy if exists "Solo administradores pueden modificar ingredientes" on public.ingredients;
drop policy if exists "Solo administradores pueden eliminar ingredientes" on public.ingredients;

-- Cualquier usuario autenticado puede consultar los ingredientes de la despensa
create policy "Cualquier usuario autenticado puede leer ingredientes"
  on public.ingredients for select
  to authenticated
  using (true);

-- Solo administradores pueden crear, modificar o eliminar ingredientes (usando is_admin() sin recursión)
create policy "Solo administradores pueden crear ingredientes"
  on public.ingredients for insert
  to authenticated
  with check (public.is_admin());

create policy "Solo administradores pueden modificar ingredientes"
  on public.ingredients for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "Solo administradores pueden eliminar ingredientes"
  on public.ingredients for delete
  to authenticated
  using (public.is_admin());


-- 5. TABLA DE PROVEEDORES DE MATERIAS PRIMAS (public.suppliers)
create table if not exists public.suppliers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text not null,
  delivery_schedule text not null,
  category text not null,
  approximate_prices text not null,
  contact_person text,
  icon text default '🚚',
  email text,
  address text,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Habilitar RLS en suppliers
alter table public.suppliers enable row level security;

-- Eliminar políticas previas si existieran
drop policy if exists "Cualquier usuario autenticado puede leer proveedores" on public.suppliers;
drop policy if exists "Solo administradores pueden crear proveedores" on public.suppliers;
drop policy if exists "Solo administradores pueden modificar proveedores" on public.suppliers;
drop policy if exists "Solo administradores pueden eliminar proveedores" on public.suppliers;

-- Políticas de seguridad para suppliers
create policy "Cualquier usuario autenticado puede leer proveedores"
  on public.suppliers for select
  to authenticated
  using (true);

create policy "Solo administradores pueden crear proveedores"
  on public.suppliers for insert
  to authenticated
  with check (public.is_admin());

create policy "Solo administradores pueden modificar proveedores"
  on public.suppliers for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "Solo administradores pueden eliminar proveedores"
  on public.suppliers for delete
  to authenticated
  using (public.is_admin());


-- 6. COMANDO ÚTIL PARA ASIGNAR O CONFIRMAR ROL DE ADMINISTRADOR MANUALMENTE (Opcional):
-- update public.profiles set role = 'admin' where email = 'admin@admin.cl';


