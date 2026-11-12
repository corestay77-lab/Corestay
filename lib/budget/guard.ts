import { currentUser, userModules } from "@/lib/data";
import { sql } from "@/lib/db";

// Hanya pengguna yang sudah login dan berlisensi Hotel Budget.
export async function budgetSession() {
  const s = await currentUser(); if (!s) return null;
  return (await userModules(s.tid, s.uid, s.role)).includes("budget") ? s : null;
}
// Laporan final per klien (tenant). Tabel dibuat otomatis saat pertama dipakai.
let ready: Promise<unknown> | null = null;
export const ensureBudgetTable = () => ready || (ready = sql.query(
  "create table if not exists budget_report(id uuid primary key default gen_random_uuid(), tenant_id uuid not null references tenants(id) on delete cascade, user_id uuid not null, file_name text not null, report_json jsonb not null, created_at timestamptz not null default now())"
).then(() => sql.query("create index if not exists budget_report_tenant on budget_report(tenant_id, created_at desc)")).catch((e) => { ready = null; throw e; }));
