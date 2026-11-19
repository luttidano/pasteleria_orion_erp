# Auditoría Técnica Integral #3 — Pastelería Orión ERP (Hallazgos Vigentes)

**Fecha de actualización:** 17 de noviembre de 2026  
**Rama:** `version-1.0`  
**Alcance revisado:** `apps/api`, `apps/web`, `packages/types`, base de datos Supabase / PostgreSQL.  
**Estado general:** Los hallazgos resueltos en auditorías previas e iteraciones recientes (bypasses frontend, Transactional Outbox Contabilidad ↔ POS, agregaciones SQL nativas en reportes, interceptor de idempotencia centralizado y desinstalación de Dexie) fueron depurados. Este documento consolida **exclusivamente los hallazgos reales y vigentes** pendientes de remediación.

---

## Tabla de Contenidos

1. [Matriz de Priorización de Hallazgos Vigentes](#1-matriz-de-priorización-de-hallazgos-vigentes)
2. [Prioridad P0: Crítico — Seguridad, RBAC, Integridad de Stock y Plataforma HTTP](#2-prioridad-p0-crítico--seguridad-rbac-integridad-de-stock-y-plataforma-http)
   - [2.1. Alteración Directa de Stock mediante PATCH en Inventario](#21-alteración-directa-de-stock-mediante-patch-en-inventario-crítico)
   - [2.2. Seguridad HTTP: Ausencia de Helmet, Rate Limiting y CORS con Error 500](#22-seguridad-http-ausencia-de-helmet-rate-limiting-y-cors-con-error-500-alto)
   - [2.3. Aplicación Manual de Guards y Falta de APP_GUARD Global](#23-aplicación-manual-de-guards-y-falta-de-app_guard-global-alto)
   - [2.4. Bypass de Prisma en UsersService y Riesgo de Eliminación del Último Admin](#24-bypass-de-prisma-en-usersservice-y-riesgo-de-eliminación-del-último-admin-crítico)
   - [2.5. Wipe Incondicional de Sesión Offline al Recargar la PWA](#25-wipe-incondicional-de-sesión-offline-al-recargar-la-pwa-crítico)
   - [2.6. Funciones SECURITY DEFINER Expuestas e Índices Duplicados en Supabase](#26-funciones-security-definer-expuestas-e-índices-duplicados-en-supabase-alto)
3. [Prioridad P1: Alto — Dominio, Valorización, UI y Zona Horaria](#3-prioridad-p1-alto--dominio-valorización-ui-y-zona-horaria)
   - [3.1. Error de Coalescencia y Omisión de Insumos en Valorización de Bodega](#31-error-de-coalescencia-y-omisión-de-insumos-en-valorización-de-bodega-alto)
   - [3.2. Desfase de Zona Horaria (UTC vs America/Santiago) en Cierres Contables](#32-desfase-de-zona-horaria-utc-vs-americasantiago-en-cierres-contables-alto)
   - [3.3. Discrepancia Visual en Balance General por Cuentas No Renderizadas](#33-discrepancia-visual-en-balance-general-por-cuentas-no-renderizadas-alto)
   - [3.4. RBAC Desalineado en Vista de Empaques (PackagingView)](#34-rbac-desalineado-en-vista-de-empaques-packagingview-medio-alto)
   - [3.5. Inconsistencia de Filtro en Pestaña Stock Bajo de Insumos Generales](#35-inconsistencia-de-filtro-en-pestaña-stock-bajo-de-insumos-generales-medio)
   - [3.6. Bloqueo de Tandas Decimales en Modal de Producción](#36-bloqueo-de-tandas-decimales-en-modal-de-producción-medio)
   - [3.7. Fuga de Temporizador setInterval en Componente PWA](#37-fuga-de-temporizador-setinterval-en-componente-pwa-medio)
   - [3.8. Fuga de Caché PWA entre Sesiones por Falta de Limpieza en Login](#38-fuga-de-caché-pwa-entre-sesiones-por-falta-de-limpieza-en-login-medio-alto)
4. [Prioridad P2: Medio — DTOs, Contratos y Desduplicación de Reglas](#4-prioridad-p2-medio--dtos-contratos-y-desduplicación-de-reglas)
   - [4.1. Incompatibilidad de DTO en Actualización de Caja Inicial POS](#41-incompatibilidad-de-dto-en-actualización-de-caja-inicial-pos-medio)
   - [4.2. Lógica Comercial y Heurísticas Duplicadas entre Frontend y Backend](#42-lógica-comercial-y-heurísticas-duplicadas-entre-frontend-y-backend-medio)
   - [4.3. Validación Laxa en DTOs Base de Inventario](#43-validación-laxa-en-dtos-base-de-inventario-medio)
5. [Plan Detallado de Remediación (Archivos, Carpetas y Código)](#5-plan-detallado-de-remediación-archivos-carpetas-y-código)

---

## 1. Matriz de Priorización de Hallazgos Vigentes

| ID | Área Auditada | Severidad | Impacto Operacional / Seguridad | Archivo(s) Principal(es) |
| :--- | :--- | :--- | :--- | :--- |
| **P0-1** | Inventario / DTOs | **Crítico** | Alteración arbitraria de stock vía `PATCH` sin Kardex ni Outbox | `apps/api/src/modules/inventory/dto/update-*.dto.ts` |
| **P0-2** | Plataforma HTTP | **Alto** | Falta de headers de seguridad, rate limiting y CORS arrojando `500` | `apps/api/src/main.ts` |
| **P0-3** | Seguridad / RBAC | **Alto** | Guards manuales por controlador sin `APP_GUARD` global *fail-closed* | `apps/api/src/app.module.ts`, `app.controller.ts` |
| **P0-4** | Usuarios / RBAC | **Crítico** | Autodegradación o eliminación del último admin; uso de PostgREST | `apps/api/src/modules/users/users.service.ts` |
| **P0-5** | PWA / Autenticación | **Crítico** | Pérdida total de sesión offline al recargar la PWA sin red | `apps/web/src/services/authService.ts` |
| **P0-6** | Base de Datos | **Alto** | Funciones RPC con `EXECUTE` público e índices duplicados en Supabase | `supabase/migrations/` |
| **P1-1** | Inventario / Costos | **Alto** | Productos elaborados valorizados en `$0` por falla de coalescencia `??` | `inventory-valuation.service.ts` |
| **P1-2** | Contabilidad | **Alto** | Ventas nocturnas asignadas a mes incorrecto por desfase UTC vs Chile | `accounting-period.service.ts` |
| **P1-3** | UI Contable | **Alto** | Descuadre visual en Balance General por omitir `otrosActivos`/`otrosPasivos` | `BalanceSheetSection.tsx` |
| **P1-4** | UI Inventario | **Medio-Alto** | Botones de escritura de empaques visibles a panaderos (error `403`) | `PackagingView.tsx`, `AppLayout.tsx` |
| **P1-5** | UI Inventario | **Medio** | Insumos agotados (`stock = 0`) listados en pestaña "Stock Bajo" | `GeneralSuppliesView.tsx` |
| **P1-6** | Producción | **Medio** | Botón `-` bloquea tandas fraccionales menores a 1 | `ProduceRecipeModal.tsx` |
| **P1-7** | PWA | **Medio** | Fuga de memoria por `setInterval` sin `clearInterval` en PWA | `PwaStatusOverlay.tsx` |
| **P1-8** | PWA / Seguridad | **Medio-Alto** | Caché SW de usuario previo no se purga al iniciar sesión | `authService.ts` |
| **P2-1** | POS / DTOs | **Medio** | Propiedades no permitidas `from`/`to` provocan `400 Bad Request` | `posShiftService.ts` |
| **P2-2** | Arquitectura | **Medio** | Reglas de bolsas y modalidad de proveedores duplicadas en FE y BE | `posPrint.ts`, `supplierService.ts` |
| **P2-3** | Inventario / DTOs | **Medio** | Ausencia de `@Type`, `@Max` y validación estricta de URLs en creación | `create-*.dto.ts` de inventario |

---

## 2. Prioridad P0: Crítico — Seguridad, RBAC, Integridad de Stock y Plataforma HTTP

### 2.1. Alteración Directa de Stock mediante PATCH en Inventario `[CRÍTICO]`
* **Archivos afectados:**
  * [`apps/api/src/modules/inventory/dto/update-product.dto.ts`](file:///c:/Users/PC/Desktop/erp-pasteleria_orion/apps/api/src/modules/inventory/dto/update-product.dto.ts)
  * [`apps/api/src/modules/inventory/dto/update-ingredient.dto.ts`](file:///c:/Users/PC/Desktop/erp-pasteleria_orion/apps/api/src/modules/inventory/dto/update-ingredient.dto.ts)
  * [`apps/api/src/modules/inventory/dto/update-packaging.dto.ts`](file:///c:/Users/PC/Desktop/erp-pasteleria_orion/apps/api/src/modules/inventory/dto/update-packaging.dto.ts)
  * [`apps/api/src/modules/inventory/dto/update-general-supply.dto.ts`](file:///c:/Users/PC/Desktop/erp-pasteleria_orion/apps/api/src/modules/inventory/dto/update-general-supply.dto.ts)
  * [`apps/api/src/modules/inventory/products/product.service.ts`](file:///c:/Users/PC/Desktop/erp-pasteleria_orion/apps/api/src/modules/inventory/products/product.service.ts#L175)
* **Causa raíz:** Los DTOs de actualización extienden directamente de `PartialType(Create*Dto)`, heredando el campo `stock`. En los servicios de inventario (por ejemplo `product.service.ts:175`), se ejecuta `...(dto.stock !== undefined && { stock: dto.stock })`.
* **Impacto:** Cualquier usuario con permisos de edición puede enviar un `PATCH /api/inventory/products/:id` con `{ "stock": 500 }`. Esto sobreescribe el stock físico directamente en la base de datos sin ejecutar `adjustStock`, sin adquirir locks pesimistas, sin generar movimientos en Kardex y sin notificar al Transactional Outbox contable.
* **Remediación:** Utilizar `PartialType(OmitType(Create*Dto, ['stock'] as const))` en todos los DTOs de actualización y eliminar la asignación de `stock` en los métodos `update()` de los servicios de inventario.

### 2.2. Seguridad HTTP: Ausencia de Helmet, Rate Limiting y CORS con Error 500 `[ALTO]`
* **Archivos afectados:**
  * [`apps/api/package.json`](file:///c:/Users/PC/Desktop/erp-pasteleria_orion/apps/api/package.json)
  * [`apps/api/src/main.ts`](file:///c:/Users/PC/Desktop/erp-pasteleria_orion/apps/api/src/main.ts#L66-L87)
* **Causa raíz:** 
  1. `main.ts` no incorpora `helmet()` para configurar cabeceras estándar de protección (CSP, HSTS, X-Content-Type-Options, etc.).
  2. No existe rate limiting (`@nestjs/throttler`) para proteger rutas sensibles contra ataques de denegación de servicio o fuerza bruta (`/api/auth/me`, `/api/users`, `/api/pos/sales`).
  3. No se configura `app.set('trust proxy', 1)`.
  4. En la línea 86 de `main.ts`, el callback de CORS ejecuta `callback(new Error('Origin not allowed by CORS policy'), false)`. En NestJS/Express, esto genera una respuesta `500 Internal Server Error` no controlada en vez de un código limpio `403 Forbidden`.
  5. Falta un filtro global de excepciones (`AllExceptionsFilter`).
* **Remediación:** Instalar y configurar `helmet`, `@nestjs/throttler`, `trust proxy`, rechazar orígenes CORS no permitidos con `ForbiddenException` e implementar un filtro global de excepciones.

### 2.3. Aplicación Manual de Guards y Falta de APP_GUARD Global `[ALTO]`
* **Archivos afectados:**
  * [`apps/api/src/app.module.ts`](file:///c:/Users/PC/Desktop/erp-pasteleria_orion/apps/api/src/app.module.ts)
  * [`apps/api/src/app.controller.ts`](file:///c:/Users/PC/Desktop/erp-pasteleria_orion/apps/api/src/app.controller.ts)
* **Causa raíz:** [`AuthGuard`](file:///c:/Users/PC/Desktop/erp-pasteleria_orion/apps/api/src/common/guards/auth.guard.ts) y [`RolesGuard`](file:///c:/Users/PC/Desktop/erp-pasteleria_orion/apps/api/src/common/guards/roles.guard.ts) se aplican manualmente con `@UseGuards(...)` en cada controlador.
* **Impacto:** Si se crea un nuevo controlador y se olvida colocar el decorador, las rutas quedan expuestas públicamente. De hecho, [`AppController`](file:///c:/Users/PC/Desktop/erp-pasteleria_orion/apps/api/src/app.controller.ts) expone `GET /api` sin protección ni anotación `@Public()`.
* **Remediación:** Registrar `AuthGuard` y `RolesGuard` como proveedores `APP_GUARD` en `AppModule` para aplicar seguridad *fail-closed* por defecto en toda la aplicación, permitiendo acceso público únicamente a los métodos explícitamente decorados con `@Public()`.

### 2.4. Bypass de Prisma en UsersService y Riesgo de Eliminación del Último Admin `[CRÍTICO]`
* **Archivos afectados:**
  * [`apps/api/src/modules/users/users.service.ts`](file:///c:/Users/PC/Desktop/erp-pasteleria_orion/apps/api/src/modules/users/users.service.ts#L85-L140)
  * [`apps/api/src/modules/users/users.controller.ts`](file:///c:/Users/PC/Desktop/erp-pasteleria_orion/apps/api/src/modules/users/users.controller.ts#L47-L52)
* **Causa raíz:**
  1. `UsersService` realiza operaciones CRUD sobre `public.profile` utilizando el cliente PostgREST de Supabase (`this.supabase.from('profile')`) en vez de [`PrismaService`](file:///c:/Users/PC/Desktop/erp-pasteleria_orion/apps/api/src/database/prisma.service.ts), perdiendo la coherencia transaccional del backend.
  2. El método `update` en `UsersController` no inyecta `@CurrentUser()`.
  3. Ni `update` ni `remove` comprueban si el usuario afectado es el último administrador activo del sistema, ni impiden que un administrador se autodegrade a `cashier` o `baker`.
* **Impacto:** Un administrador descuidado o malicioso puede autodegradarse o eliminar al único administrador activo, dejando el ERP bloqueado sin capacidad de gestión de accesos.
* **Remediación:** Migrar las lecturas y escrituras de `public.profile` a `this.prisma.profile`, inyectar el usuario autenticado en `UsersController.update` y agregar validación que impida la autodegradación o la reducción de administradores a 0.

### 2.5. Wipe Incondicional de Sesión Offline al Recargar la PWA `[CRÍTICO]`
* **Archivo afectado:**
  * [`apps/web/src/services/authService.ts`](file:///c:/Users/PC/Desktop/erp-pasteleria_orion/apps/web/src/services/authService.ts#L336-L350)
* **Causa raíz:** En la inicialización del frontend (`ensureAuthReady`), se invoca `fetchAuthoritativeProfile`. Si la PWA se recarga en un dispositivo que perdió la conectividad a internet, la petición falla por error de red (`status === 0` o excepción en `fetch`). El bloque `else` y el bloque `catch` ejecutan inmediatamente:
  ```ts
  inMemoryAuthToken = null;
  persistVerifiedUser(null);
  ```
* **Impacto:** La sesión local se borra por completo y el usuario es expulsado a la pantalla de inicio de sesión, impidiendo que el cajero o panadero consulte el catálogo o la lista de precios en modo offline.
* **Remediación:** En `ensureAuthReady`, si el error es de red (`status === 0` o `TypeError: Failed to fetch`), preservar el usuario verificado almacenado en caché local y no limpiar el token si aún no ha expirado.

### 2.6. Funciones SECURITY DEFINER Expuestas e Índices Duplicados en Supabase `[ALTO]`
* **Entorno afectado:** Base de datos PostgreSQL en Supabase.
* **Causa raíz:**
  1. `public.is_admin()` (`SECURITY DEFINER`, huérfana) y `public.handle_new_user()` conservan privilegios `EXECUTE` otorgados a `PUBLIC`, `anon` y `authenticated` a través de `/rest/v1/rpc/*`.
  2. Existe la función legacy `public.create_pos_sale_transaction()` sin stock ni contabilidad.
  3. Coexisten 5 índices duplicados en `pos_sale` y `pos_sale_item` (`idx_pos_sales_payment_method`, `idx_pos_sales_sold_at`, `idx_pos_sales_status`, `idx_pos_sale_items_product_id`, `idx_pos_sale_items_sale_id`).
* **Remediación:** Crear y ejecutar la migración SQL de endurecimiento:
  ```sql
  REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
  DROP FUNCTION IF EXISTS public.is_admin();
  DROP FUNCTION IF EXISTS public.create_pos_sale_transaction(text, text, numeric, numeric, numeric, jsonb);
  DROP INDEX IF EXISTS public.idx_pos_sales_payment_method;
  DROP INDEX IF EXISTS public.idx_pos_sales_sold_at;
  DROP INDEX IF EXISTS public.idx_pos_sales_status;
  DROP INDEX IF EXISTS public.idx_pos_sale_items_product_id;
  DROP INDEX IF EXISTS public.idx_pos_sale_items_sale_id;
  ```

---

## 3. Prioridad P1: Alto — Dominio, Valorización, UI y Zona Horaria

### 3.1. Error de Coalescencia y Omisión de Insumos en Valorización de Bodega `[ALTO]`
* **Archivo afectado:**
  * [`apps/api/src/modules/inventory/valuation/inventory-valuation.service.ts`](file:///c:/Users/PC/Desktop/erp-pasteleria_orion/apps/api/src/modules/inventory/valuation/inventory-valuation.service.ts#L95-L117)
* **Causa raíz:**
  1. En la línea 101: `unitCost: Number(prod.costPrice ?? prod.salePrice ?? 0)`. En PostgreSQL, la columna `cost_price` de `product` tiene un valor por defecto numérico `0`. En JavaScript, la expresión `0 ?? prod.salePrice` evalúa a `0` (el operador nullish coalescing no activa el fallback ante ceros). Como consecuencia, los productos elaborados sin costo unitario asignado se valorizan en `$0` en vez de usar su precio de venta de referencia.
  2. La tabla `general_supply` no se incluye en el cálculo total del valor de bodega.
* **Remediación:** Corregir la expresión a `prod.costPrice && Number(prod.costPrice) > 0 ? Number(prod.costPrice) : Number(prod.salePrice ?? 0)` e incorporar los insumos operativos (`GeneralSupply`) al consolidado de valorización.

### 3.2. Desfase de Zona Horaria (UTC vs America/Santiago) en Cierres Contables `[ALTO]`
* **Archivos afectados:**
  * [`apps/api/src/modules/accounting/accounting-period.service.ts`](file:///c:/Users/PC/Desktop/erp-pasteleria_orion/apps/api/src/modules/accounting/accounting-period.service.ts#L221-L259)
  * [`apps/api/src/common/utils/chile-time.util.ts`](file:///c:/Users/PC/Desktop/erp-pasteleria_orion/apps/api/src/common/utils/chile-time.util.ts)
* **Causa raíz:** En el Outbox y en ventas, las fechas se registran como marcas de tiempo UTC. Al verificar ventas pendientes para autorizar el cierre de un período mensual, `AccountingPeriodService` aplica límites de inicio y fin de mes basados en UTC (00:00:00Z a 23:59:59Z).
* **Impacto:** Debido a que Chile opera en UTC-3 (o UTC-4 en invierno), cualquier venta realizada el último día del mes entre las 21:00 y las 23:59 hora local cae en el primer día del mes siguiente en horario UTC. Esto provoca discrepancias al validar si existen eventos pendientes antes de cerrar el período contable.
* **Remediación:** Utilizar rangos de fecha calculados explícitamente en la zona horaria `America/Santiago` convertidos a límites UTC equivalentes (`getChileMonthDateRangeUtc()`).

### 3.3. Discrepancia Visual en Balance General por Cuentas No Renderizadas `[ALTO]`
* **Archivo afectado:**
  * [`apps/web/src/components/accounting/BalanceSheetSection.tsx`](file:///c:/Users/PC/Desktop/erp-pasteleria_orion/apps/web/src/components/accounting/BalanceSheetSection.tsx#L46-L128)
* **Causa raíz:** En la vista del Balance General, en la columna de Activos solo se renderizan las tarjetas de `disponible` e `inventarios`. En la columna de Pasivos, solo se renderiza `obligaciones`. Se omiten por completo los grupos `activos.otrosActivos` y `pasivos.otrosPasivos`. Sin embargo, las etiquetas de totales (`TOTAL ACTIVOS` y `TOTAL PASIVOS`) sí suman el valor de estos grupos omitidos.
* **Impacto:** Si una cuenta contable clasifica bajo otros activos u otros pasivos, el total de la tarjeta general es superior a la suma de las cuentas listadas en pantalla, generando confusión en el contador.
* **Remediación:** Agregar los bloques JSX correspondientes para renderizar las cuentas y subtotales de `otrosActivos` y `otrosPasivos` cuando contengan cuentas asociadas.

### 3.4. RBAC Desalineado en Vista de Empaques (PackagingView) `[MEDIO-ALTO]`
* **Archivos afectados:**
  * [`apps/web/src/components/layout/AppLayout.tsx`](file:///c:/Users/PC/Desktop/erp-pasteleria_orion/apps/web/src/components/layout/AppLayout.tsx#L454)
  * [`apps/web/src/components/inventory/packaging/PackagingView.tsx`](file:///c:/Users/PC/Desktop/erp-pasteleria_orion/apps/web/src/components/inventory/packaging/PackagingView.tsx#L20-L27, L167-L177)
* **Causa raíz:** La interfaz `PackagingViewProps` no recibe la propiedad `user`. Por ende, el botón "Nuevo Empaque" y las acciones de edición y eliminación se renderizan incondicionalmente para todos los usuarios.
* **Impacto:** En el backend, [`PackagingController`](file:///c:/Users/PC/Desktop/erp-pasteleria_orion/apps/api/src/modules/inventory/packaging.controller.ts) restringe `POST`, `PATCH` y `DELETE` exclusivamente al rol `admin`. Cuando un panadero o cajero intenta crear o editar un empaque, la operación es rechazada con un error `403 Forbidden`.
* **Remediación:** Pasar el prop `user={user}` desde `AppLayout` a `PackagingView` y condicionar la visualización de los botones de mutación a `user?.role === 'admin'`.

### 3.5. Inconsistencia de Filtro en Pestaña Stock Bajo de Insumos Generales `[MEDIO]`
* **Archivo afectado:**
  * [`apps/web/src/components/inventory/general-supplies/GeneralSuppliesView.tsx`](file:///c:/Users/PC/Desktop/erp-pasteleria_orion/apps/web/src/components/inventory/general-supplies/GeneralSuppliesView.tsx#L78, L97)
* **Causa raíz:** La métrica de la tarjeta calcula los insumos en stock bajo con la condición estricta: `stock > 0 && stock <= minStock`. En cambio, el filtro de la tabla para la pestaña `'low_stock'` evalúa: `item.stock > item.minStock ? false : true`. Esto incluye también a los elementos con `stock <= 0` (agotados).
* **Impacto:** El contador de la pestaña muestra por ejemplo "2 ítems", pero al hacer clic en ella la tabla despliega 5 filas (incluyendo los 3 insumos con stock 0).
* **Remediación:** Alinear el filtro de tabla para que `'low_stock'` filtre únicamente `item.stock > 0 && item.stock <= item.minStock`.

### 3.6. Bloqueo de Tandas Decimales en Modal de Producción `[MEDIO]`
* **Archivo afectado:**
  * [`apps/web/src/components/inventory/recipes/ProduceRecipeModal.tsx`](file:///c:/Users/PC/Desktop/erp-pasteleria_orion/apps/web/src/components/inventory/recipes/ProduceRecipeModal.tsx#L246)
* **Causa raíz:** El botón `-` ejecuta: `setBatches((b) => Math.max(1, (Number(b) || 1) - 1))`.
* **Impacto:** Aunque el input numérico soporta `min="0.01"` y `step="any"` para elaborar medias tandas (por ejemplo 0.5 recetas), el botón de decremento impide reducir el valor por debajo de 1.
* **Remediación:** Ajustar la lógica del botón para permitir decrementar valores decimales respetando el límite mínimo de `0.01`.

### 3.7. Fuga de Temporizador setInterval en Componente PWA `[MEDIO]`
* **Archivo afectado:**
  * [`apps/web/src/components/pwa/PwaStatusOverlay.tsx`](file:///c:/Users/PC/Desktop/erp-pasteleria_orion/apps/web/src/components/pwa/PwaStatusOverlay.tsx#L23-L27)
* **Causa raíz:** En la función `onRegisteredSW`, se invoca `window.setInterval` para comprobar actualizaciones periódicas del Service Worker. El identificador del intervalo no se almacena ni se limpia mediante `clearInterval` al desmontar el componente.
* **Impacto:** Fuga de recursos en memoria si el componente sufre remontajes o cambios de ciclo de vida.
* **Remediación:** Almacenar la referencia del temporizador y asegurar su limpieza en el retorno del efecto de React.

### 3.8. Fuga de Caché PWA entre Sesiones por Falta de Limpieza en Login `[MEDIO-ALTO]`
* **Archivo afectado:**
  * [`apps/web/src/services/authService.ts`](file:///c:/Users/PC/Desktop/erp-pasteleria_orion/apps/web/src/services/authService.ts#L453-L510)
* **Causa raíz:** `clearPwaApiCaches()` solo se ejecuta en `logout()`, y lo hace sin `await`. Durante el flujo de `login()`, no se ejecuta ninguna limpieza de las cachés de Service Worker (`orion-api-catalog-reads`).
* **Impacto:** Si un panadero inicia sesión inmediatamente después de un administrador en el mismo dispositivo sin un cierre de sesión explícito previo, el nuevo usuario puede acceder a datos en caché de endpoints protegidos (como proveedores) mediante el fallback offline del Service Worker.
* **Remediación:** Invocar `await clearPwaApiCaches()` al inicio del método `login()`.

---

## 4. Prioridad P2: Medio — DTOs, Contratos y Desduplicación de Reglas

### 4.1. Incompatibilidad de DTO en Actualización de Caja Inicial POS `[MEDIO]`
* **Archivos afectados:**
  * [`apps/web/src/services/posShiftService.ts`](file:///c:/Users/PC/Desktop/erp-pasteleria_orion/apps/web/src/services/posShiftService.ts#L18-L22)
  * [`apps/api/src/modules/pos/dto/pos-shift.dto.ts`](file:///c:/Users/PC/Desktop/erp-pasteleria_orion/apps/api/src/modules/pos/dto/pos-shift.dto.ts#L22-L32)
* **Causa raíz:** El frontend define el tipo de payload como `{ openingCash: number; from?: string; to?: string; }`. El backend define [`UpdateOpeningCashDto`](file:///c:/Users/PC/Desktop/erp-pasteleria_orion/apps/api/src/modules/pos/dto/pos-shift.dto.ts#L22-L32) conteniendo exclusivamente la propiedad `openingCash`.
* **Impacto:** Al tener habilitado `forbidNonWhitelisted: true` en el `ValidationPipe` global de NestJS, si el frontend envía los campos opcionales `from` o `to`, la petición es rechazada con un error HTTP `400 Bad Request`.
* **Remediación:** Remover los campos `from` y `to` de la firma de `updateOpeningCash` en `posShiftService.ts`.

### 4.2. Lógica Comercial y Heurísticas Duplicadas entre Frontend y Backend `[MEDIO]`
* **Archivos afectados:**
  * [`apps/api/src/common/utils/money.util.ts`](file:///c:/Users/PC/Desktop/erp-pasteleria_orion/apps/api/src/common/utils/money.util.ts#L20-L22) y [`apps/web/src/components/pos/posPrint.ts`](file:///c:/Users/PC/Desktop/erp-pasteleria_orion/apps/web/src/components/pos/posPrint.ts#L45-L53) (`resolveSecondaryPackagingPrice`).
  * [`apps/api/src/modules/inventory/suppliers/supplier.service.ts`](file:///c:/Users/PC/Desktop/erp-pasteleria_orion/apps/api/src/modules/inventory/suppliers/supplier.service.ts#L34-L55) y [`apps/web/src/services/supplierService.ts`](file:///c:/Users/PC/Desktop/erp-pasteleria_orion/apps/web/src/services/supplierService.ts#L5-L27) (`detectSupplyModality`).
* **Causa raíz:** La regla legal de cobro de bolsas secundarias ($100 CLP) y la heurística de modalidad de proveedores están implementadas por duplicado en cliente y servidor con ligeras variaciones de código.
* **Remediación:** Exportar estas funciones desde el paquete compartido [`@repo/types`](file:///c:/Users/PC/Desktop/erp-pasteleria_orion/packages/types) o unificar la fuente de verdad en el backend.

### 4.3. Validación Laxa en DTOs Base de Inventario `[MEDIO]`
* **Archivos afectados:**
  * [`apps/api/src/modules/inventory/dto/create-product.dto.ts`](file:///c:/Users/PC/Desktop/erp-pasteleria_orion/apps/api/src/modules/inventory/dto/create-product.dto.ts)
  * [`apps/api/src/modules/inventory/dto/create-ingredient.dto.ts`](file:///c:/Users/PC/Desktop/erp-pasteleria_orion/apps/api/src/modules/inventory/dto/create-ingredient.dto.ts)
  * [`apps/api/src/modules/inventory/dto/create-packaging.dto.ts`](file:///c:/Users/PC/Desktop/erp-pasteleria_orion/apps/api/src/modules/inventory/dto/create-packaging.dto.ts)
  * [`apps/api/src/modules/inventory/dto/create-general-supply.dto.ts`](file:///c:/Users/PC/Desktop/erp-pasteleria_orion/apps/api/src/modules/inventory/dto/create-general-supply.dto.ts)
* **Causa raíz:** Omiten el decorador `@Type(() => Number)` en propiedades numéricas enviadas como texto, no fijan límites superiores con `@Max`, omiten `@MaxLength` en nombres y no restringen el protocolo `http(s):` en el campo opcional `imageUrl`.
* **Remediación:** Enriquecer las clases con decoradores de validación estrictos de `class-validator` y `class-transformer`.

---

## 5. Plan Detallado de Remediación (Archivos, Carpetas y Código)

### Carpetas a Crear:
1. `apps/api/src/common/filters/` (para `AllExceptionsFilter`).

### Archivos a Crear:
1. `apps/api/src/common/filters/all-exceptions.filter.ts`:
   * Normalización centralizada de excepciones no controladas y errores de conexión a PostgreSQL.
2. `supabase/migrations/0010_security_hardening.sql`:
   * Revocación de permisos en funciones RPC expuestas y eliminación de los 5 índices duplicados.

### Archivos a Modificar:

#### Backend (`apps/api`):
* [`apps/api/package.json`](file:///c:/Users/PC/Desktop/erp-pasteleria_orion/apps/api/package.json):
  * Agregar dependencias: `helmet`, `@nestjs/throttler`, `@types/helmet`.
* [`apps/api/src/main.ts`](file:///c:/Users/PC/Desktop/erp-pasteleria_orion/apps/api/src/main.ts):
  * Agregar `helmet()`, `expressApp.set('trust proxy', 1)`, cambiar callback CORS a `new ForbiddenException(...)` y registrar `AllExceptionsFilter`.
* [`apps/api/src/app.module.ts`](file:///c:/Users/PC/Desktop/erp-pasteleria_orion/apps/api/src/app.module.ts):
  * Configurar `ThrottlerModule` y registrar `AuthGuard` y `RolesGuard` como `APP_GUARD`.
* [`apps/api/src/app.controller.ts`](file:///c:/Users/PC/Desktop/erp-pasteleria_orion/apps/api/src/app.controller.ts):
  * Decorar `getHello()` y `checkHealth()` con `@Public()`.
* DTOs de Inventario (`apps/api/src/modules/inventory/dto/`):
  * Modificar `update-product.dto.ts`, `update-ingredient.dto.ts`, `update-packaging.dto.ts`, `update-general-supply.dto.ts` usando `OmitType(..., ['stock'])`.
* Servicios de Inventario (`apps/api/src/modules/inventory/`):
  * Remover `stock` de las mutaciones `update()` en `product.service.ts`, `ingredient.service.ts`, `packaging.service.ts` y `general-supply.service.ts`.
* [`apps/api/src/modules/users/users.service.ts`](file:///c:/Users/PC/Desktop/erp-pasteleria_orion/apps/api/src/modules/users/users.service.ts) y [`users.controller.ts`](file:///c:/Users/PC/Desktop/erp-pasteleria_orion/apps/api/src/modules/users/users.controller.ts):
  * Migrar mutaciones a `this.prisma.profile`, inyectar `@CurrentUser()`, y validar último administrador.
* [`apps/api/src/modules/inventory/valuation/inventory-valuation.service.ts`](file:///c:/Users/PC/Desktop/erp-pasteleria_orion/apps/api/src/modules/inventory/valuation/inventory-valuation.service.ts):
  * Corregir coalescencia de costo y sumar insumos generales.

#### Frontend (`apps/web`):
* [`apps/web/src/services/authService.ts`](file:///c:/Users/PC/Desktop/erp-pasteleria_orion/apps/web/src/services/authService.ts):
  * Preservar sesión local cuando `status === 0`, y ejecutar `await clearPwaApiCaches()` en `login()`.
* [`apps/web/src/components/pwa/PwaStatusOverlay.tsx`](file:///c:/Users/PC/Desktop/erp-pasteleria_orion/apps/web/src/components/pwa/PwaStatusOverlay.tsx):
  * Limpiar el temporizador `setInterval` con `clearInterval` en la función de limpieza.
* [`apps/web/src/components/layout/AppLayout.tsx`](file:///c:/Users/PC/Desktop/erp-pasteleria_orion/apps/web/src/components/layout/AppLayout.tsx):
  * Proveer `user={user}` a `<PackagingView>`.
* [`apps/web/src/components/inventory/packaging/PackagingView.tsx`](file:///c:/Users/PC/Desktop/erp-pasteleria_orion/apps/web/src/components/inventory/packaging/PackagingView.tsx):
  * Recibir `user` y condicionar visibilidad de botones CRUD a rol `admin`.
* [`apps/web/src/components/inventory/general-supplies/GeneralSuppliesView.tsx`](file:///c:/Users/PC/Desktop/erp-pasteleria_orion/apps/web/src/components/inventory/general-supplies/GeneralSuppliesView.tsx):
  * Ajustar el filtro `'low_stock'` para excluir ítems con stock menor o igual a 0.
* [`apps/web/src/components/inventory/recipes/ProduceRecipeModal.tsx`](file:///c:/Users/PC/Desktop/erp-pasteleria_orion/apps/web/src/components/inventory/recipes/ProduceRecipeModal.tsx):
  * Ajustar el decremento a `0.01` como cota inferior en vez de `1`.
* [`apps/web/src/components/accounting/BalanceSheetSection.tsx`](file:///c:/Users/PC/Desktop/erp-pasteleria_orion/apps/web/src/components/accounting/BalanceSheetSection.tsx):
  * Renderizar los desgloses de `otrosActivos` y `otrosPasivos`.
* [`apps/web/src/services/posShiftService.ts`](file:///c:/Users/PC/Desktop/erp-pasteleria_orion/apps/web/src/services/posShiftService.ts):
  * Remover propiedades `from` y `to` en `updateOpeningCash`.
