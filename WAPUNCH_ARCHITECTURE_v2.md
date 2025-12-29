# WAPunch – Database Architecture Reference (v2)

Este documento resume la arquitectura lógica y el esquema de base de datos de WAPunch (Supabase/Postgres) para ser usado como **contexto base** en prompts de Cursor al desarrollar el frontend administrativo.

> **Cambios clave vs la versión anterior:** el modelo de asistencia ahora es **auditable** (datos reales vs modificados), se basa en **Days + Sessions + Daily Summary**, e integra **Schedule/Planner + Time Off + Tolerancias por empresa**.

---

## 1. Conceptos Clave del Modelo

### Identidades y acceso
- **auth.users** (Supabase Auth): identidad técnica (email, auth, etc).
- **company_users**: usuarios administrativos/operativos dentro de una empresa.
- **workers**: trabajadores que pueden marcar asistencia (employees o contractors).

### 🔑 Regla fundamental
- Todos los **workers** son **company_users**.
- No todos los **company_users** son **workers** (ej. admins, managers, visores).

---

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

### Triggers relevantes
- **Manual site por defecto** (para marcaciones sin ubicación exacta):

```sql
create trigger trg_create_manual_site
after insert on companies
for each row
execute function create_manual_site_for_company();
```

- **Attendance settings por defecto** (tolerancias de tardanza/salida/OT):

```sql
create trigger trg_create_company_attendance_settings
after insert on public.companies
for each row
execute function public.create_company_attendance_settings();
```

---

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
  constraint company_users_company_id_fkey foreign key (company_id) references companies (id) on delete cascade,
  constraint company_users_user_id_fkey foreign key (user_id) references auth.users (id) on delete cascade
);
```

### Índice Único
```sql
create unique index company_users_user_company_uniq
on public.company_users (user_id, company_id)
where is_deleted = false;
```

---

## 4. Tabla: workers

Trabajadores que realizan marcaciones de asistencia.

> Nota: `worker_type` distingue employees vs contractors, pero **la evaluación de asistencia** (fixed/planned/open) se define por reglas de trabajo (ver sección 8).

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
  constraint workers_company_id_fkey foreign key (company_id) references companies (id) on delete cascade,
  constraint workers_user_id_fkey foreign key (user_id) references auth.users (id) on delete set null,
  constraint workers_worker_type_check check (worker_type in ('employee', 'contractor'))
);
```

### Estados válidos (current_status)
- `out`
- `in`
- `on_break`
- `on_transfer`

---

## 5. Attendance: modelo auditable (Real vs Modificado)

### 5.1 attendance_logs (eventos crudos, **inmutables**)
Registro crudo de cada evento de marcación.

```sql
create table public.attendance_logs (
  id uuid not null default extensions.uuid_generate_v4 (),
  worker_id uuid not null,
  company_id uuid not null,
  site_id uuid not null,
  log_type public.attendance_log_type not null,
  log_time timestamptz not null default now(),
  latitude numeric(10, 6) null,
  longitude numeric(10, 6) null,
  source text null default 'whatsapp',
  raw_message text null,
  anonymized boolean not null default false,
  created_at timestamptz null default now(),
  constraint attendance_logs_pkey primary key (id)
);
```

**Regla:** los logs originales **no se editan**. Cualquier corrección se registra como override.

### 5.2 attendance_log_overrides (correcciones)
Cada override referencia un log original y guarda el valor corregido + auditoría.

```sql
create table public.attendance_log_overrides (
  id uuid not null default extensions.uuid_generate_v4(),
  original_log_id uuid not null,
  company_id uuid not null,
  worker_id uuid not null,
  overridden_log_time timestamptz not null,
  overridden_log_type public.attendance_log_type not null,
  reason text null,
  modified_by uuid not null,
  modified_at timestamptz not null default now(),
  constraint attendance_log_overrides_pkey primary key (id),
  constraint attendance_log_overrides_original_fkey
    foreign key (original_log_id) references attendance_logs (id) on delete cascade
);
```

### 5.3 attendance_logs_effective (vista “efectiva”)
Vista que aplica el override más reciente (si existe) y expone el flag `is_modified`.

> La UI normal usa “effective”; el modo auditoría (botón **M**) muestra los logs reales.

---

## 6. Attendance: Days + Sessions + Daily Summary

### 6.1 attendance_days (1 worker + 1 día)
Identidad del “día de asistencia”. Se usa para expandir sesiones y generar summary.

```sql
create table public.attendance_days (
  id uuid not null default extensions.uuid_generate_v4(),
  company_id uuid not null,
  worker_id uuid not null,
  work_date date not null,
  is_modified boolean not null default false,
  created_at timestamptz default now(),
  constraint attendance_days_pkey primary key (id),
  constraint attendance_days_unique unique (worker_id, work_date)
);
```

### 6.2 attendance_sessions (bloques de tiempo)
Cada sesión representa un bloque continuo de tiempo con significado: `work`, `break`, `transfer`, `time_off`.

Características clave:
- `attendance_day_id` enlaza el día.
- `crosses_midnight` se mantiene por trigger para UI (mostrar “(+1)”).
- `source` indica si viene de `attendance` (logs), `time_off/planner` o `manual`.

```sql
create type public.attendance_session_type as enum ('work','break','transfer','time_off');

create table public.attendance_sessions (
  id uuid not null default extensions.uuid_generate_v4(),
  attendance_day_id uuid not null,
  company_id uuid not null,
  worker_id uuid not null,
  session_type public.attendance_session_type not null,
  start_time timestamptz not null,
  end_time timestamptz not null,
  duration_minutes int not null,
  source text not null default 'attendance',
  is_modified boolean not null default false,
  modified_by uuid null,
  modified_at timestamptz null,
  notes text null,
  crosses_midnight boolean not null default false,
  created_at timestamptz default now(),
  constraint attendance_sessions_pkey primary key (id)
);
```

#### UI: sesiones que cruzan medianoche
- La sesión **pertenece al día donde inicia**
- En UI se muestra `(+1)` cuando `crosses_midnight = true`

### 6.3 attendance_daily_summary (la tabla principal del Attendance UI)
Tabla calculada por día, usada para renderizar listas rápidas, filtros y export.

Campos clave (resumen):
- Expected: `expected_minutes`, `expected_source`
- Actual: `worked_minutes`, `break_minutes`, `transfer_minutes`
- Excepciones: `late_minutes`, `early_leave_minutes`, `overtime_minutes`
- Flags: `is_time_off`, `is_modified`, `has_*`
- `attendance_day_id` (FK) es el “join” para expand.

---

## 7. Planner / Schedule + Time Off

### 7.1 planned_shifts (work y time_off por fecha)
Un worker puede tener **varios shifts por día**.

```sql
create type public.planned_shift_type as enum ('work','time_off');

create table public.planned_shifts (
  id uuid not null default extensions.uuid_generate_v4(),
  company_id uuid not null,
  worker_id uuid not null,
  site_id uuid null,
  shift_date date not null,
  start_time time not null,
  end_time time not null,
  shift_type public.planned_shift_type not null default 'work',
  break_minutes int not null default 0,
  is_overtime_allowed boolean not null default false,
  notes text null,
  created_at timestamptz default now(),
  constraint planned_shifts_pkey primary key (id)
);
```

### 7.2 time_off_requests (solicitudes/approval)
Al aprobarse, genera sesiones `time_off` (y recalcula summary).

```sql
create type public.time_off_status as enum ('pending','approved','rejected');
create type public.time_off_type as enum ('vacation','sick','personal','unpaid','other');

create table public.time_off_requests (
  id uuid not null default extensions.uuid_generate_v4(),
  company_id uuid not null,
  worker_id uuid not null,
  start_date date not null,
  end_date date not null,
  time_off_type public.time_off_type not null,
  status public.time_off_status not null default 'pending',
  approved_by uuid null,
  notes text null,
  created_at timestamptz default now(),
  constraint time_off_requests_pkey primary key (id)
);
```

> Time off parcial: se modela como `planned_shifts(shift_type='time_off')` y se descuenta del expected del día.

---

## 8. Reglas de trabajo (Fixed / Planned / Open)

### 8.1 worker_work_rules
Define cómo evaluar cada worker en un rango de fechas.

```sql
create type public.worker_work_rule_type as enum ('fixed','planned','open');

create table public.worker_work_rules (
  id uuid not null default extensions.uuid_generate_v4(),
  company_id uuid not null,
  worker_id uuid not null,
  rule_type public.worker_work_rule_type not null,
  start_date date not null,
  end_date date null,
  created_at timestamptz default now(),
  constraint worker_work_rules_pkey primary key (id)
);
```

### 8.2 fixed_schedules + fixed_schedule_days
Horario recurrente por día de semana.

```sql
create table public.fixed_schedules (
  id uuid not null default extensions.uuid_generate_v4(),
  company_id uuid not null,
  name text not null,
  timezone text not null default 'UTC',
  created_at timestamptz default now(),
  constraint fixed_schedules_pkey primary key (id)
);

create table public.fixed_schedule_days (
  id uuid not null default extensions.uuid_generate_v4(),
  fixed_schedule_id uuid not null,
  day_of_week int not null check (day_of_week between 0 and 6),
  is_working boolean not null default true,
  start_time time null,
  end_time time null,
  break_minutes int not null default 0,
  constraint fixed_schedule_days_pkey primary key (id)
);
```

---

## 9. Tolerancias por empresa

### company_attendance_settings
Guarda tolerancias de:
- tardanza
- salida temprana
- overtime

```sql
create table public.company_attendance_settings (
  company_id uuid not null primary key,
  late_tolerance_minutes int not null default 5,
  early_leave_tolerance_minutes int not null default 5,
  overtime_tolerance_minutes int not null default 0,
  created_at timestamptz default now()
);
```

---

## 10. Funciones y flujo de cálculo

### Funciones clave
- `ensure_attendance_day(company_id, worker_id, work_date)` → garantiza `attendance_days`.
- `rebuild_attendance_sessions_for_day(company_id, worker_id, work_date)` → reconstruye sesiones `attendance` desde `attendance_logs_effective`.
- `calculate_expected_for_day(company_id, worker_id, work_date)` → expected_minutes/source/start/end (incluye descuento de time off parcial).
- `calculate_attendance_daily_summary(attendance_day_id)` → upsert del summary con tolerancias.

### Flujo general (mental model)

```
attendance_logs (reales, inmutables)
        │
        ├── attendance_log_overrides (correcciones)
        │
        ▼
attendance_logs_effective (vista)
        ▼
attendance_days (1 por worker/día)
        ▼
attendance_sessions (work/break/transfer/time_off)
        ▼
attendance_daily_summary (lista principal / reportes)
```

---

## 11. Reglas importantes para el Frontend

- El `company_id` activo define todo el contexto.
- Los permisos se basan en `company_users.role`.
- El estado actual del trabajador vive en `workers.current_status`.
- La tabla principal del módulo Attendance es `attendance_daily_summary`.
- El “expand” usa `attendance_sessions` por `attendance_day_id`.
- El botón **M** alterna entre:
  - vista normal (efectivo) y
  - auditoría (logs reales / comparación).
- No recalcular asistencia en frontend: confiar en DB y triggers.

---

## 12. Seguridad y Row Level Security (RLS)

### Principio general
**Ningún usuario puede ver información de una empresa a la que no pertenece.**
Toda consulta debe estar restringida por `company_id` y validada contra `company_users`.

### Nota de inserciones
- Los inserts de `attendance_logs` normalmente vienen de backend (n8n/edge) con **service role**.
- El frontend administrativo típicamente es read-only para logs/sesiones (salvo módulos de corrección con permisos).

### Tablas nuevas a proteger con RLS (además de las existentes)
- `attendance_days`
- `attendance_sessions`
- `attendance_daily_summary`
- `attendance_log_overrides`
- `planned_shifts`
- `time_off_requests`
- `worker_work_rules`
- `fixed_schedules`
- `fixed_schedule_days`
- `company_attendance_settings`

> Recomendación: replicar el patrón de policies por `company_id` usando `company_users` como “membership table”.

---

## 13. Prompt base para Cursor (copiar/pegar)

> "WAPunch uses strict Row Level Security. Every table is protected by company-based RLS using company_users. The Attendance module is driven by attendance_daily_summary; row expansion queries attendance_sessions by attendance_day_id. Original attendance_logs are immutable; corrections live in attendance_log_overrides and the UI can toggle audit mode (M) to view original vs effective data."

---

**Fin del documento (v2)**
