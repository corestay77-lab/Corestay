// Dihasilkan dari db/schema.sql (dipakai halaman /setup).
export const SCHEMA: string[] = [
  "create table if not exists tenants(id uuid primary key default gen_random_uuid(), slug text unique not null, name text not null, status text not null default 'active', created_at timestamptz default now())",
  "create table if not exists hotels(id uuid primary key default gen_random_uuid(), tenant_id uuid not null references tenants(id) on delete cascade, name text not null, city text, tz text default 'Asia/Jakarta')",
  "create table if not exists users(id uuid primary key default gen_random_uuid(), tenant_id uuid not null references tenants(id) on delete cascade, username text not null, pass_hash text not null, role text not null check (role in ('owner','gm','staff')), hotel_ids uuid[] default '{}', modules text[] not null default '{}', active boolean default true, unique(tenant_id, username))",
  "create table if not exists licenses(id uuid primary key default gen_random_uuid(), tenant_id uuid not null references tenants(id) on delete cascade, code text unique not null, status text not null default 'active', starts_at date default current_date, expires_at date)",
  "create table if not exists license_modules(license_id uuid not null references licenses(id) on delete cascade, module text not null, primary key(license_id, module))",
  "create table if not exists audit_log(id bigserial primary key, tenant_id uuid, user_id uuid, action text not null, detail jsonb, at timestamptz default now())",
  "create index if not exists hotels_tenant on hotels(tenant_id)",
  "create index if not exists audit_tenant on audit_log(tenant_id, at desc)",
  "alter table users add column if not exists modules text[] not null default '{}'"
];
