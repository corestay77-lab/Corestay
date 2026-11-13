import { timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { sql } from "@/lib/db";
import { readAny, signAny } from "@/lib/auth";

// Admin platform (pemilik CoreStay): kredensial dari environment Vercel, sesi terpisah dari sesi klien.
export const ADMIN_COOKIE = "csa";
export const adminTtl = 8 * 3600;
const same = (a: string, b: string) => { const x = Buffer.from(a), y = Buffer.from(b); return x.length === y.length && timingSafeEqual(x, y); };
export const adminConfigured = () => !!process.env.ADMIN_USER && (process.env.ADMIN_PASSWORD || "").length >= 14;
export const checkAdmin = (u: string, p: string) => adminConfigured() && same(u.trim().toLowerCase(), String(process.env.ADMIN_USER).toLowerCase()) && same(p, String(process.env.ADMIN_PASSWORD));
export const adminToken = (u: string) => signAny({ k: "admin", u, exp: Date.now() + adminTtl * 1000 });
export async function adminSession(): Promise<{ u: string } | null> {
  const s = readAny((await cookies()).get(ADMIN_COOKIE)?.value);
  return s && s.k === "admin" && Number(s.exp) > Date.now() ? { u: String(s.u) } : null;
}

const D = (c: string) => `to_char(${c},'YYYY-MM-DD')`;
export type Client = { id: string; slug: string; name: string; status: string; created: string; hotels: number; users: number; code: string | null; expires: string | null; modules: string[] };
export async function listClients(): Promise<Client[]> {
  const r = await sql.query(`select t.id, t.slug, t.name, t.status, ${D("t.created_at")} as created,
    (select count(*) from hotels h where h.tenant_id=t.id)::int as hotels, (select count(*) from users u where u.tenant_id=t.id and u.active)::int as users,
    l.code, ${D("l.expires_at")} as expires, coalesce((select array_agg(m.module order by m.module) from license_modules m where m.license_id=l.id), '{}') as modules
    from tenants t left join lateral (select * from licenses where tenant_id=t.id and status='active' order by expires_at desc nulls first limit 1) l on true order by t.created_at desc`);
  return r as Client[];
}
export async function clientDetail(id: string) {
  if (!/^[0-9a-f-]{36}$/.test(id)) return null;
  const [t] = await listClients().then((a) => a.filter((c) => c.id === id));
  if (!t) return null;
  const [hotels, users, audit] = await Promise.all([
    sql.query("select id::text as id, name, city from hotels where tenant_id=$1 order by name", [id]),
    sql.query("select id::text as id, username, role, active, modules from users where tenant_id=$1 order by role, username", [id]),
    sql.query(`select a.action, ${"to_char(a.at at time zone 'Asia/Jakarta','YYYY-MM-DD HH24:MI')"} as at, u.username from audit_log a left join users u on u.id=a.user_id where a.tenant_id=$1 order by a.at desc limit 30`, [id]),
  ]);
  return { t, hotels: hotels as { id: string; name: string; city: string | null }[], users: users as { id: string; username: string; role: string; active: boolean; modules: string[] }[], audit: audit as { action: string; at: string; username: string | null }[] };
}
