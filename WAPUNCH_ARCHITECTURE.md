# WAPunch – Database Schema Reference

Este documento resume la arquitectura lógica y el esquema de base de datos de WAPunch para ser usado como contexto base en prompts de Cursor al desarrollar el frontend administrativo.

⸻

## 1. Conceptos Clave del Modelo

### Usuarios
- **auth.users** (Supabase Auth): identidad técnica (email, auth, etc).
- **company_users**: usuarios administrativos/operativos dentro de una empresa.
- **workers**: trabajadores que pueden marcar asistencia (employees o contractors).

### 🔑 Regla fundamental:

- Todos los **workers** son **company_users**.
- No todos los **company_users** son **workers** (ej. admins, managers, visores).

⸻

## 2. Tabla: companies

Representa a las empresas clientes.

```sql
create table public.companies (
  id uuid not null default extensions.uuid_generate_v4 (),
  name text not null,
  country text null,
  timezone text null default 'UTC'::text,
  address text null,
  is_active boolean not null default true,
  created_at timestamp with time zone null default now(),
  updated_at timestamp with time zone null default now(),
  constraint companies_pkey primary key (id)
);
```

### Notas
- Cada empresa tiene su zona horaria propia.
- Al crear una empresa se ejecuta automáticamente:

```sql
create trigger trg_create_manual_site
after INSERT on companies
for EACH row
execute FUNCTION create_manual_site_for_company();
```

Esto crea un site manual por defecto para marcaciones sin ubicación exacta.

⸻

## 3. Tabla: company_users

Usuarios administrativos y operativos asociados a una empresa.

```sql
create table public.company_users (
  id uuid not null default extensions.uuid_generate_v4 (),
  user_id uuid not null,
  company_id uuid not null,
  role public.user_role not null default 'employee'::user_role,
  archived boolean not null default false,
  is_deleted boolean not null default false,
  created_at timestamp with time zone null default now(),
  constraint company_users_pkey primary key (id),
  constraint company_users_company_id_fkey foreign KEY (company_id) references companies (id) on delete CASCADE,
  constraint company_users_user_id_fkey foreign KEY (user_id) references auth.users (id) on delete CASCADE
);
```

### Índice Único

```sql
create unique index company_users_user_company_uniq
on public.company_users (user_id, company_id)
where is_deleted = false;
```

### Uso en Frontend
- Control de roles (admin, manager, viewer, employee).
- Determina acceso a módulos del dashboard.
- Un mismo usuario puede pertenecer a múltiples empresas.

⸻

## 4. Tabla: workers

Trabajadores que realizan marcaciones de asistencia.

```sql
create table public.workers (
  id uuid not null default extensions.uuid_generate_v4 (),
  company_id uuid not null,
  user_id uuid not null,
  first_name text not null,
  last_name text not null,
  whatsapp_number text not null,
  worker_code text null,
  worker_type text not null default 'employee',
  position text null,
  department_id uuid null,
  job_title_id uuid null,
  is_active boolean not null default true,
  archived boolean not null default false,
  is_deleted boolean not null default false,
  created_at timestamp with time zone null default now(),
  updated_at timestamp with time zone null default now(),
  anonymized_at timestamp with time zone null,
  current_status text not null default 'out',
  constraint workers_pkey primary key (id),
  constraint workers_company_id_fkey foreign KEY (company_id) references companies (id) on delete CASCADE,
  constraint workers_user_id_fkey foreign KEY (user_id) references auth.users (id) on delete set null,
  constraint workers_worker_type_check CHECK (worker_type IN ('employee', 'contractor')),
  constraint workers_department_id_fkey foreign KEY (department_id) references departments (id) on delete set null,
  constraint workers_job_title_id_fkey foreign KEY (job_title_id) references job_titles (id) on delete set null
);
```

### Estados válidos (current_status)
- `out`
- `in`
- `on_break`
- `on_transfer`

### Tipos de Trabajador (worker_type)
- `employee`: Empleado permanente (tiempo completo o parcial)
- `contractor`: Contratista o freelancer temporal

### Índices Únicos
- Usuario por empresa
- WhatsApp por empresa
- Código de trabajador por empresa

### Relaciones
- `department_id`: Referencia a `departments` (opcional, puede ser null)
- `job_title_id`: Referencia a `job_titles` (opcional, puede ser null)

### Uso en Frontend
- Lista principal de trabajadores
- Estado en tiempo real
- Enlace directo con marcaciones
- Identificación por WhatsApp
- Reportería diferenciada por tipo de trabajador
- Filtrado y agrupación por departamento y job title

⸻

## 4.1. Tabla: departments

Departamentos dentro de una empresa.

```sql
create table public.departments (
  id uuid not null default extensions.uuid_generate_v4 (),
  company_id uuid not null,
  name text not null,
  description text null,
  is_active boolean not null default true,
  is_deleted boolean not null default false,
  created_at timestamp with time zone null default now(),
  updated_at timestamp with time zone null default now(),
  constraint departments_pkey primary key (id),
  constraint departments_company_id_fkey foreign KEY (company_id) references companies (id) on delete CASCADE
);
```

### Índices Únicos
- Nombre de departamento por empresa (no puede haber duplicados)

### Uso en Frontend
- Dropdown de departamentos en formularios de workers
- Administración de departamentos en settings
- Filtrado de workers por departamento
- Agrupación en reportes

⸻

## 4.2. Tabla: job_titles

Títulos de trabajo dentro de una empresa.

```sql
create table public.job_titles (
  id uuid not null default extensions.uuid_generate_v4 (),
  company_id uuid not null,
  name text not null,
  description text null,
  is_active boolean not null default true,
  is_deleted boolean not null default false,
  created_at timestamp with time zone null default now(),
  updated_at timestamp with time zone null default now(),
  constraint job_titles_pkey primary key (id),
  constraint job_titles_company_id_fkey foreign KEY (company_id) references companies (id) on delete CASCADE
);
```

### Índices Únicos
- Nombre de job title por empresa (no puede haber duplicados)

### Uso en Frontend
- Dropdown de job titles en formularios de workers
- Administración de job titles en settings
- Filtrado de workers por job title
- Agrupación en reportes

⸻

## 5. Tabla: attendance_logs

Registro crudo de cada evento de marcación.

```sql
create table public.attendance_logs (
  id uuid not null default extensions.uuid_generate_v4 (),
  worker_id uuid not null,
  company_id uuid not null,
  site_id uuid not null,
  log_type public.attendance_log_type not null,
  log_time timestamp with time zone not null default now(),
  latitude numeric(10, 6) null,
  longitude numeric(10, 6) null,
  source text null default 'whatsapp',
  raw_message text null,
  anonymized boolean not null default false,
  created_at timestamp with time zone null default now(),
  constraint attendance_logs_pkey primary key (id)
);
```

### Triggers Importantes

```
after insert → handle_attendance_log_insert()
after insert → handle_attendance_summary()
```

### Uso en Frontend
- Vista de logs individuales
- Auditoría
- Mapa / ubicación
- Fuente del evento (WhatsApp, sistema, etc.)

⸻

## 6. Tabla: attendance_summary

Sesiones consolidadas derivadas de los logs.

```sql
create table public.attendance_summary (
  id uuid not null default extensions.uuid_generate_v4 (),
  worker_id uuid not null,
  company_id uuid not null,
  site_id uuid not null,
  session_type text not null,
  start_log_id uuid not null,
  end_log_id uuid null,
  start_time timestamp with time zone not null,
  end_time timestamp with time zone null,
  duration_seconds integer null,
  source text null default 'system',
  created_at timestamp with time zone null default now(),
  updated_at timestamp with time zone null default now(),
  constraint attendance_summary_pkey primary key (id)
);
```

### Tipos de Sesión
- `work`
- `break`
- `transfer`

### Conceptos Clave
- Una sesión abierta tiene `end_time = null`.
- La duración se calcula automáticamente.
- Se alimenta solo desde `attendance_logs`.

### Uso en Frontend
- Dashboard de asistencia
- Horas trabajadas
- Reportes diarios / semanales
- Estado actual del trabajador
- Filtros por worker_type para análisis diferenciado

⸻

## 7. Relación General (Mental Model)

```
auth.users
   │
   ▼
company_users
   │
   ├── (no worker)
   │
   ▼
workers
   │
   ├── department_id → departments (opcional)
   ├── job_title_id → job_titles (opcional)
   ├── attendance_logs  (eventos)
   └── attendance_summary (sesiones)

companies
   │
   ├── departments (múltiples)
   ├── job_titles (múltiples)
   └── sites (múltiples)
```

⸻

## 8. Reglas Importantes para el Frontend
- El `company_id` activo define todo el contexto.
- Los permisos se basan en `company_users.role`.
- El estado actual del trabajador vive en `workers.current_status`.
- Las horas se calculan desde `attendance_summary`, no desde logs.
- Los logs nunca se editan, solo se anonimizan.
- La columna `worker_type` permite diferenciar employees de contractors para reportería.
- `departments` y `job_titles` son específicos por empresa y se administran en settings.
- Los workers pueden tener `department_id` y `job_title_id` como null (opcionales).

⸻

## 9. Cómo usar este documento en Cursor

Ejemplo de prompt:

> "Usa el esquema de WAPunch. Estoy construyendo la vista de Employees para una empresa activa. Debe listar empleados, su estado actual, última marcación, horas del día (desde attendance_summary) y permitir ver el historial de attendance_logs."

⸻

## 14. Seguridad y Row Level Security (RLS)

### Principio General

**Ningún usuario puede ver información de una empresa a la que no pertenece.**
Toda consulta debe estar restringida por `company_id` y validada contra `company_users`.

Todas las tablas productivas tienen RLS habilitado.

⸻

### Helper Conceptual (mental model)

En todas las policies se repite la misma idea:
- El usuario autenticado (`auth.uid()`) debe existir en `company_users`
- Debe coincidir el `company_id`
- El registro no debe estar `is_deleted = true`

⸻

### RLS – companies

```sql
alter table public.companies enable row level security;

create policy companies_select
on public.companies
for select
using (
  exists (
    select 1
    from company_users cu
    where cu.company_id = companies.id
      and cu.user_id = auth.uid()
      and cu.is_deleted = false
  )
);
```

⸻

### RLS – company_users

```sql
alter table public.company_users enable row level security;

-- Ver usuarios solo de mi empresa
create policy company_users_select
on public.company_users
for select
using (
  exists (
    select 1
    from company_users cu2
    where cu2.company_id = company_users.company_id
      and cu2.user_id = auth.uid()
      and cu2.is_deleted = false
  )
);

-- Solo admins pueden insertar
create policy company_users_insert_admin
on public.company_users
for insert
with check (
  exists (
    select 1
    from company_users cu
    where cu.company_id = company_users.company_id
      and cu.user_id = auth.uid()
      and cu.role in ('admin','super_admin')
      and cu.is_deleted = false
  )
);

-- Solo admins pueden actualizar
create policy company_users_update_admin
on public.company_users
for update
using (
  exists (
    select 1
    from company_users cu
    where cu.company_id = company_users.company_id
      and cu.user_id = auth.uid()
      and cu.role in ('admin','super_admin')
      and cu.is_deleted = false
  )
);
```

⸻

### RLS – workers

```sql
alter table public.workers enable row level security;

-- Ver trabajadores solo de mi empresa
create policy workers_select
on public.workers
for select
using (
  exists (
    select 1
    from company_users cu
    where cu.company_id = workers.company_id
      and cu.user_id = auth.uid()
      and cu.is_deleted = false
  )
);

-- Crear trabajadores (admin / manager)
create policy workers_insert
on public.workers
for insert
with check (
  exists (
    select 1
    from company_users cu
    where cu.company_id = workers.company_id
      and cu.user_id = auth.uid()
      and cu.role in ('admin','manager','super_admin')
      and cu.is_deleted = false
  )
);

-- Actualizar trabajadores (admin / manager)
create policy workers_update
on public.workers
for update
using (
  exists (
    select 1
    from company_users cu
    where cu.company_id = workers.company_id
      and cu.user_id = auth.uid()
      and cu.role in ('admin','manager','super_admin')
      and cu.is_deleted = false
  )
);
```

⸻

### RLS – attendance_logs

```sql
alter table public.attendance_logs enable row level security;

create policy attendance_logs_select
on public.attendance_logs
for select
using (
  exists (
    select 1
    from company_users cu
    where cu.company_id = attendance_logs.company_id
      and cu.user_id = auth.uid()
      and cu.is_deleted = false
  )
);
```

📌 **Nota**: los inserts normalmente vienen del backend (n8n / edge functions) usando service role.

⸻

### RLS – attendance_summary

```sql
alter table public.attendance_summary enable row level security;

create policy attendance_summary_select
on public.attendance_summary
for select
using (
  exists (
    select 1
    from company_users cu
    where cu.company_id = attendance_summary.company_id
      and cu.user_id = auth.uid()
      and cu.is_deleted = false
  )
);
```

⸻

## 15. Reglas de Seguridad Clave (para Cursor)
- ❌ Nunca confiar en filtros del frontend
- ✅ Siempre filtrar por `company_id` vía RLS
- ❌ Un admin no puede ver otra empresa
- ❌ Un employee no accede al dashboard
- ✅ Backend (n8n / edge) usa service role

⸻

## 16. Prompt Base de Seguridad (copiar/pegar)

> "WAPunch uses strict Row Level Security. Every table is protected by company-based RLS using company_users. Authenticated admin users can only access data belonging to companies where they have a company_users record. Employees never authenticate into the admin UI. Attendance logs and summaries are read-only from the frontend."

⸻

**Fin del documento**

