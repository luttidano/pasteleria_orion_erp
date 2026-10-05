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

-- 4. POBLAR INGREDIENTES INICIALES DE PASTELERÍA (Opcional)
insert into public.ingredients (name, category, stock, min_stock, unit, price, icon, description, status)
values
  ('Harina de Trigo Repostera (Sin polvos)', 'Harinas y Polvos', 50, 20, 'kg', 1250, '🌾', 'Harina fina especial para bizcochos, tortas y masas quebradas.', 'suficiente'),
  ('Mantequilla sin Sal 82% materia grasa', 'Lácteos y Huevos', 8, 15, 'kg', 6800, '🧈', 'Fundamental para hojaldres, croissants y cremas de mantequilla.', 'bajo'),
  ('Leche Entera Natural Pasteurizada', 'Lácteos y Huevos', 24, 10, 'Litros', 1100, '🥛', 'Para remojo de bizcochos, tres leches y cremas pasteleras.', 'suficiente'),
  ('Huevos Frescos de Campo (Bandeja 30 un)', 'Lácteos y Huevos', 6, 4, 'Bandejas', 6500, '🥚', 'Huevos frescos seleccionados para merengues, queques y batidos.', 'suficiente'),
  ('Crema de Leche para Batir 35%', 'Lácteos y Huevos', 3, 8, 'Litros', 4900, '🍶', 'Crema espesa para chantilly fresco y ganache de chocolate.', 'bajo'),
  ('Azúcar Granulada Blanca', 'Azúcares y Dulces', 35, 15, 'kg', 1350, '🍬', 'Azúcar pura para batidos y almíbares.', 'suficiente'),
  ('Azúcar Flor / Glacé Cernida', 'Azúcares y Dulces', 0, 6, 'kg', 2100, '🍥', 'Para glaseados finos, macarons y espolvorear masas.', 'agotado'),
  ('Chocolate Semi-Amargo 60% Gotas', 'Chocolates y Cacaos', 12, 8, 'kg', 8900, '🍫', 'Para fundir, ganache, selva negra y volcanes de chocolate.', 'suficiente'),
  ('Manjar Artesanal de Campo Tradicional', 'Azúcares y Dulces', 18, 10, 'kg', 3600, '🍯', 'Dulce de leche repostero consistente para relleno de tortas y alfajores.', 'suficiente'),
  ('Polvo de Hornear Doble Acción', 'Harinas y Polvos', 4, 2, 'kg', 4500, '✨', 'Leudante químico para queques esponjosos y galletas.', 'suficiente'),
  ('Extracto Puro de Vainilla Bourbon', 'Frutas y Esencias', 1, 3, 'Litros', 18000, '🌸', 'Esencia aromática natural para cremas y masas.', 'bajo'),
  ('Frutos Rojos Mixtos Congelados', 'Frutas y Esencias', 10, 5, 'kg', 5200, '🍓', 'Frambuesas, moras y arándanos para cheesecakes y coulis.', 'suficiente')
on conflict do nothing;

-- 5. COMANDO ÚTIL PARA CONVERTIR UN USUARIO EN ADMINISTRADOR:
-- update public.profiles set role = 'admin' where email = 'tu_correo@dominio.com';
