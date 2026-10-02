# Pastelería Orión ERP — Documentación de Arquitectura y Referencia Técnica

> **Guía maestra del sistema:** Este documento detalla la estructura, archivos, flujos de datos, diseño y componentes desarrollados para el ERP de **Pastelería Orión**. Sirve como mapa de navegación directo para evitar búsquedas manuales archivo por archivo.

---

## 1. Arquitectura General del Monorepo (Turborepo + pnpm)

El proyecto está organizado en un monorepo administrado por **Turborepo** y **pnpm workspaces**:

```
pasteleria_orion_erp/
├── apps/
│   ├── web/                     # Aplicación Frontend (React 19 + Vite + Tailwind CSS)
│   └── api/                     # Backend NestJS (Prisma ORM, endpoints futuros)
├── packages/
│   ├── types/                   # Tipos TypeScript compartidos entre apps
│   ├── ui/                      # Componentes compartidos de Turborepo
│   ├── eslint-config/           # Reglas ESLint unificadas
│   └── typescript-config/       # Configuraciones base de TypeScript
├── package.json                 # Scripts raíz del monorepo
├── pnpm-workspace.yaml          # Declaración de workspaces
└── turbo.json                   # Pipeline de tareas y caché de Turborepo
```

---

## 2. Mapa Detallado de Archivos y Componentes

### 📦 Paquete de Tipos Compartidos (`packages/types`)
| Archivo | Ruta | Descripción y Contenido |
|---|---|---|
| `index.ts` | [packages/types/index.ts](file:///c:/Users/Luis/Documents/Programación/pasteleria_orion_erp/packages/types/index.ts) | Define las interfaces canónicas del sistema: `Product` (materia prima/insumo), `User`, `UserRole` (`'admin' \| 'user'`), `IngredientCategory`, `StockStatus` (`'suficiente' \| 'bajo' \| 'agotado'`), `UnitOfMeasure`, `ToastMessage`. |

---

### 🎨 Frontend Web (`apps/web`)

#### Configuración y Estilos Base
| Archivo | Ruta | Responsabilidad |
|---|---|---|
| `index.html` | [apps/web/index.html](file:///c:/Users/Luis/Documents/Programación/pasteleria_orion_erp/apps/web/index.html) | Carga fuentes Google Fonts (`Playfair Display`, `Cormorant Garamond`, `Plus Jakarta Sans`) e inyecta un script pre-hidratación que lee `localStorage.getItem('orion_theme')` para aplicar la clase `.dark` a `<html>` antes del primer render (evita parpadeos). |
| `tailwind.config.js` | [apps/web/tailwind.config.js](file:///c:/Users/Luis/Documents/Programación/pasteleria_orion_erp/apps/web/tailwind.config.js) | Configuración de Tailwind CSS con `darkMode: 'class'`, paleta de colores de pastelería (`orion.burgundy: #8C1F25`, `orion.cream: #FAF5ED`, etc.) y fuentes serif/sans. |
| `src/index.css` | [apps/web/src/index.css](file:///c:/Users/Luis/Documents/Programación/pasteleria_orion_erp/apps/web/src/index.css) | Reglas `@layer base` para `html` y `body`. Define el fondo apergaminado claro `#FAF5ED` y el fondo espresso noche `#0F0B09` para `.dark` y `[data-theme="dark"]`. |
| `src/App.css` | [apps/web/src/App.css](file:///c:/Users/Luis/Documents/Programación/pasteleria_orion_erp/apps/web/src/App.css) | Animaciones micro-interactivas (`animate-fade-in`, `animate-modal-pop`). |

#### Contextos y Estado Global
| Archivo | Ruta | Responsabilidad |
|---|---|---|
| `ThemeContext.tsx` | [apps/web/src/context/ThemeContext.tsx](file:///c:/Users/Luis/Documents/Programación/pasteleria_orion_erp/apps/web/src/context/ThemeContext.tsx) | `ThemeProvider` y hook `useTheme()`. Gestiona `isDarkMode`, `theme` (`'dark' \| 'light'`), `toggleDarkMode()` y sincroniza de forma inmediata las clases en `<html>` y `<body>`, actualizando `localStorage('orion_theme')`. |

#### Capa de Servicios y Almacenamiento Local (Listo para Supabase)
| Archivo | Ruta | Responsabilidad |
|---|---|---|
| `authService.ts` | [apps/web/src/services/authService.ts](file:///c:/Users/Luis/Documents/Programación/pasteleria_orion_erp/apps/web/src/services/authService.ts) | Lógica de inicio de sesión y registro. Soporta el usuario especial administrador `admin` / `1234` y usuarios regulares guardados en `localStorage`. Diseñado con interfaces asíncronas para conectarse directamente con `supabase.auth`. |
| `inventoryService.ts` | [apps/web/src/services/inventoryService.ts](file:///c:/Users/Luis/Documents/Programación/pasteleria_orion_erp/apps/web/src/services/inventoryService.ts) | Base de datos IndexedDB local mediante **Dexie.js** con fallback a memoria y `localStorage`. Precarga 12 ingredientes iniciales reales (Harina, Mantequilla, Leche, Huevos, Azúcar, Chocolate, etc.). Métodos CRUD: `getProducts()`, `addProduct()`, `updateProduct()`, `deleteProduct()`, `updateStockDelta()`, `resetToDefaults()`. Listo para conectar con la tabla `ingredients` de Supabase. |

#### Vistas Principales y Layout
| Archivo | Ruta | Responsabilidad |
|---|---|---|
| `App.tsx` | [apps/web/src/App.tsx](file:///c:/Users/Luis/Documents/Programación/pasteleria_orion_erp/apps/web/src/App.tsx) | Enrutador y orquestador raíz. Envuelve la app en `<ThemeProvider>`, gestiona notificaciones flotantes `<ToastContainer>`, y conmuta entre: 1) Vista de login (`AuthPage`), 2) Panel Administrador (`AdminLayout`), 3) Portal de Usuario estándar (`UserPortalView`). |
| `AuthPage.tsx` | [apps/web/src/components/auth/AuthPage.tsx](file:///c:/Users/Luis/Documents/Programación/pasteleria_orion_erp/apps/web/src/components/auth/AuthPage.tsx) | Pantalla de inicio de sesión y registro con la tipografía emblemática (*Pastelería Orión*), botón rápido *"Auto-completar Admin"*, y selector de tema claro/oscuro. |
| `AdminLayout.tsx` | [apps/web/src/components/admin/AdminLayout.tsx](file:///c:/Users/Luis/Documents/Programación/pasteleria_orion_erp/apps/web/src/components/admin/AdminLayout.tsx) | Contenedor del ERP de Administrador: barra lateral `Sidebar`, cabecera superior con **título del módulo perfectamente centrado**, botón único de modo oscuro/claro, y renderizado dinámico de módulos (Despensa, Compras, Recetas, Proveedores, Ajustes). |
| `Sidebar.tsx` | [apps/web/src/components/admin/Sidebar.tsx](file:///c:/Users/Luis/Documents/Programación/pasteleria_orion_erp/apps/web/src/components/admin/Sidebar.tsx) | Menú lateral colapsable (ancho `w-72` expandido o `w-20` contraído). En la cabecera incluye el botón único de menú y el **título institucional centrado estilo login** (`PASTELERÍA Orión`), sin textos redundantes ni elementos amontonados. |
| `InventoryView.tsx` | [apps/web/src/components/admin/InventoryView.tsx](file:///c:/Users/Luis/Documents/Programación/pasteleria_orion_erp/apps/web/src/components/admin/InventoryView.tsx) | Módulo principal de la Despensa de Insumos: título centrado, semáforo visual métrico (En Despensa, Queda Poco, Agotados), barra de búsqueda, selector de categorías por emoji, alternancia de vista cuadrícula/tabla, y botones de ajuste rápido de stock (`+1`, `-1`). |
| `ProductModal.tsx` | [apps/web/src/components/admin/ProductModal.tsx](file:///c:/Users/Luis/Documents/Programación/pasteleria_orion_erp/apps/web/src/components/admin/ProductModal.tsx) | Ventana modal centrada para Crear y Editar materias primas: selección de emoji, categoría, existencias actuales, unidad de medida (`kg`, `Litros`, `Bandejas`, etc.) y umbral de aviso de stock mínimo. Compatible con modo claro y oscuro. |
| `DeleteConfirmModal.tsx` | [apps/web/src/components/admin/DeleteConfirmModal.tsx](file:///c:/Users/Luis/Documents/Programación/pasteleria_orion_erp/apps/web/src/components/admin/DeleteConfirmModal.tsx) | Ventana modal centrada para confirmar eliminación de un insumo, con advertencia amigable al pastelero sugiriendo dejar el stock en 0 en vez de eliminarlo si solo se agotó temporalmente. |
| `UserPortalView.tsx` | [apps/web/src/components/user/UserPortalView.tsx](file:///c:/Users/Luis/Documents/Programación/pasteleria_orion_erp/apps/web/src/components/user/UserPortalView.tsx) | Vista restringida para usuarios que no son administradores (clientes o colaboradores sin privilegios de modificación de inventario). |
| `Toast.tsx` | [apps/web/src/components/common/Toast.tsx](file:///c:/Users/Luis/Documents/Programación/pasteleria_orion_erp/apps/web/src/components/common/Toast.tsx) | Sistema de notificaciones flotantes con soporte de éxito, advertencia, error e información. |
| `OrionLogo.tsx` | [apps/web/src/components/common/OrionLogo.tsx](file:///c:/Users/Luis/Documents/Programación/pasteleria_orion_erp/apps/web/src/components/common/OrionLogo.tsx) | Componente reutilizable del sello medallón con espiga reposteril y degradados carmesí (`#8C1F25` a `#5A0E13`) para branding. |

---

## 3. Lógica de Autenticación y Credenciales

### Credencial de Administrador (Para pruebas)
* **Usuario:** `admin`
* **Contraseña:** `1234`
* **Rol:** `admin` (Acceso completo al ERP de inventario de materias primas)

### Usuarios Estándar
Cualquier cuenta creada mediante el formulario de *"Registrarme"* recibe el rol `user`. Estos usuarios son redirigidos a la vista portal ([UserPortalView.tsx](file:///c:/Users/Luis/Documents/Programación/pasteleria_orion_erp/apps/web/src/components/user/UserPortalView.tsx)), garantizando la separación de vistas requerida.

---

## 4. Dominio de Negocio: Insumos de Pastelería

El sistema no gestiona pasteles terminados en este módulo, sino **materias primas para elaboración**:

### Categorías Oficiales
1. `Harinas y Polvos` (🌾 Harina sin polvos, polvos de hornear, maicena)
2. `Lácteos y Huevos` (🧈 Mantequilla 82%, leche entera, huevos frescos, crema chantilly)
3. `Azúcares y Dulces` (🍬 Azúcar flor, azúcar granulada, manjar repostero)
4. `Chocolates y Cacaos` (🍫 Gotas de chocolate 60%, cacao amargo en polvo)
5. `Frutas y Esencias` (🍓 Frutos rojos congelados, esencia de vainilla pura)
6. `Grasas y Aceites` (Aceite vegetal, manteca)

### Unidades de Medida Pasteleras
* `kg` (Kilogramos)
* `Litros` (L)
* `Bandejas` (ej: Bandeja de 30 huevos)
* `Unidades` (un)
* `Gramos` (g)

---

## 5. Reglas de Filtrado del Semáforo de Despensa

El inventario cuenta con tarjetas métricas interactivas en la parte superior:

* **En Despensa:** Filtra ingredientes con existencias normales (`stock > minStock`).
* **Queda Poco:** Filtra estrictamente ingredientes en zona de aviso (`stock > 0 && stock <= minStock`).
* **Agotados (Estricto):** Filtra **únicamente** aquellos ingredientes donde la cantidad disponible sea menor o igual a 0 (`stock <= 0`).
* **Ver lo que falta comprar:** Filtra todos los insumos que requieren compra (`stock <= minStock`).

---

## 6. Sistema de Diseño y Modos de Color

### Modo Claro (Contraste Cálido Repostero)
* **Fondo del canvas:** `#FAF5ED` (Crema pergamino cálido, no blanco cegador).
* **Tarjetas:** Blanco `#FFFFFF` con borde galleta horneada `#DFCAA9` o `#EADBCE`.
* **Tipografía:** Café tostado espresso oscuro `#1C120D` y `#2A1B16` para máxima legibilidad.
* **Color primario de acción:** Carmesí Orión `#8C1F25` (hover `#74191E`).

### Modo Oscuro (Noche Repostera / Espresso Bitter)
* **Fondo del canvas:** `#0F0B09` (Tostado café profundo).
* **Tarjetas y barras:** `#16100E` con bordes chocolate tostado `#35251F`.
* **Tipografía:** Crema cálido `#FDF5EE` y `#D5C2B4`.
* **Detalles dorados:** `#D4A373` y `#E8BD8A`.

### Control de Tema Unificado
* El botón de cambio de modo se encuentra **exclusivamente en la barra superior**.
* Guarda la elección en `localStorage` con la clave `'orion_theme'`.
* El script en `index.html` aplica la clase `.dark` antes del render de React.

---

## 7. Preparación para Conexión con Supabase

Toda la capa de datos está desacoplada en `services/`:

### Variables de entorno necesarias (`apps/web/.env` y `apps/api/.env`)
```env
VITE_SUPABASE_URL=https://tu-proyecto.supabase.co
VITE_SUPABASE_ANON_KEY=tu-anon-key-aqui
```

### Tablas sugeridas en Supabase SQL:
```sql
-- Tabla de materias primas
create table ingredients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text not null,
  stock numeric not null default 0,
  unit text not null default 'kg',
  min_stock numeric not null default 0,
  price numeric,
  icon text,
  description text,
  status text not null default 'suficiente',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Tabla de perfiles de usuario
create table profiles (
  id uuid primary key references auth.users(id),
  name text not null,
  role text not null default 'user', -- 'admin' o 'user'
  created_at timestamptz default now()
);
```

Para conectar con Supabase:
1. Reemplazar las llamadas de `authService.ts` por `supabase.auth.signInWithPassword` y `supabase.auth.signUp`.
2. Reemplazar las operaciones Dexie en `inventoryService.ts` por `supabase.from('ingredients').select()`, `.insert()`, `.update()`, `.delete()`.

---

## 8. Comandos de Operación

Desde la raíz del monorepo (`pasteleria_orion_erp`):

```bash
# Iniciar servidor de desarrollo frontend y backend
pnpm run dev

# Compilar todos los proyectos con Turborepo
pnpm run build

# Compilar únicamente el frontend web
pnpm --filter web run build

# Verificación de linter
pnpm run lint
```

---

*Documento actualizado en la rama `version-1.0` de Git.*
