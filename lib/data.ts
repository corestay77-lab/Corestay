import { sql } from "./db";
import { getSession } from "./auth";

// Semua fungsi menerima tenantId dari sesi. Setiap query wajib memakai "tenant_id = $1".
export async function tenantInfo(tid: string) {
  const [t] = await sql.query("select name from tenants where id=$1 and status='active'", [tid]);
  const hotels = await sql.query("select id,name,city from hotels where tenant_id=$1 order by name", [tid]);
  return t ? { name: t.name as string, hotels: hotels as { id: string; name: string; city: string | null }[] } : null;
}
// Modul yang dilisensikan untuk klien.
export async function tenantModules(tid: string): Promise<string[]> {
  const r = await sql.query(
    "select distinct m.module from licenses l join license_modules m on m.license_id=l.id where l.tenant_id=$1 and l.status='active' and (l.expires_at is null or l.expires_at>=current_date)",
    [tid]);
  return r.map((x) => x.module as string);
}
// Modul yang boleh dibuka pengguna: Owner dan GM semua modul berlisensi; staf hanya yang diberikan kepadanya.
export async function userModules(tid: string, uid: string, role: string): Promise<string[]> {
  const lic = await tenantModules(tid);
  if (role !== "staff") return lic;
  const [u] = await sql.query("select modules from users where id=$1 and tenant_id=$2 and active", [uid, tid]);
  return u ? lic.filter((m) => (u.modules as string[]).includes(m)) : [];
}
// Sesi yang masih valid dan penggunanya masih aktif (pengguna yang dinonaktifkan langsung tidak bisa masuk).
export async function currentUser() {
  const s = await getSession(); if (!s) return null;
  const [u] = await sql.query("select 1 from users where id=$1 and tenant_id=$2 and active", [s.uid, s.tid]);
  return u ? s : null;
}
export const listUsers = (tid: string) =>
  sql.query("select id,username,role,modules,hotel_ids,active from users where tenant_id=$1 order by role,username", [tid]);
export const audit = (tid: string, uid: string | null, action: string, detail: object = {}) =>
  sql.query("insert into audit_log(tenant_id,user_id,action,detail) values($1,$2,$3,$4)", [tid, uid, action, JSON.stringify(detail)]);
