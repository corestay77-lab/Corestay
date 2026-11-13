import { randomBytes } from "node:crypto";
import { sql } from "@/lib/db";
import { hashPassword } from "@/lib/auth";
import { SCHEMA } from "@/lib/schema";

export const MOD_KEYS = ["hris", "finance", "crm", "ops", "budget"];
export type NewTenant = { slug: string; name: string; hotel: string; city?: string; username: string; password: string; modules: string[]; days: number };

// Membuat klien lengkap: klien, hotel pertama, Owner, dan lisensi. Dipakai /setup dan Aplikasi Lisensi.
export async function createTenant(o: NewTenant): Promise<{ id: string; code: string }> {
  const slug = o.slug.trim().toLowerCase(), username = o.username.trim().toLowerCase();
  if (!/^[a-z0-9-]{2,30}$/.test(slug)) throw new Error("Kode klien 2-30 karakter: huruf kecil, angka, strip.");
  if (!o.name.trim() || !o.hotel.trim()) throw new Error("Nama klien dan nama hotel wajib diisi.");
  if (!/^[a-z0-9._-]{3,30}$/.test(username)) throw new Error("Username 3-30 karakter: huruf kecil, angka, titik, strip.");
  if (o.password.length < 10) throw new Error("Password minimal 10 karakter.");
  const mods = o.modules.filter((m) => MOD_KEYS.includes(m));
  if (!mods.length) throw new Error("Pilih minimal satu modul.");
  const days = Math.max(1, Math.min(3650, Math.floor(o.days) || 365));
  for (const st of SCHEMA) await sql.query(st);
  await sql.query("create unique index if not exists hotels_name_uq on hotels(lower(name))").catch(() => {});
  // Login memakai nama hotel, jadi nama harus unik di seluruh platform (tidak boleh sama dengan hotel, nama klien, atau kode klien lain).
  const taken = async (x: string) => (await sql.query("select 1 from hotels where lower(name)=lower($1) union all select 1 from tenants where lower(slug)=lower($1) or lower(name)=lower($1)", [x])).length > 0;
  if (await taken(slug)) throw new Error("Kode klien sudah dipakai atau sama dengan nama hotel/klien lain.");
  if (await taken(o.name.trim())) throw new Error("Nama klien sudah dipakai atau sama dengan nama hotel lain.");
  if (await taken(o.hotel.trim())) throw new Error("Nama hotel sudah dipakai klien lain. Tambahkan kota atau ciri lain agar unik, misalnya \"Grand Hotel Bandung\".");
  if ((await sql.query("select 1 from tenants where slug=$1", [slug])).length) throw new Error("Kode klien sudah dipakai.");
  let tid = "";
  try {
    const [t] = await sql.query("insert into tenants(slug,name) values($1,$2) returning id", [slug, o.name.trim()]); tid = t.id;
    const [h] = await sql.query("insert into hotels(tenant_id,name,city) values($1,$2,$3) returning id", [tid, o.hotel.trim(), o.city?.trim() || null]);
    await sql.query("insert into users(tenant_id,username,pass_hash,role,hotel_ids) values($1,$2,$3,'owner',$4)", [tid, username, hashPassword(o.password), [h.id]]);
    const code = "CS-" + randomBytes(5).toString("hex").toUpperCase();
    const [l] = await sql.query("insert into licenses(tenant_id,code,expires_at) values($1,$2,current_date + $3::int) returning id", [tid, code, days]);
    for (const m of mods) await sql.query("insert into license_modules(license_id,module) values($1,$2)", [l.id, m]);
    return { id: tid, code };
  } catch (e) {
    if (tid) await sql.query("delete from tenants where id=$1", [tid]).catch(() => {});
    throw e;
  }
}
