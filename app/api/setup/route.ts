import { NextResponse } from "next/server";
import { randomBytes, timingSafeEqual } from "node:crypto";
import { sql } from "@/lib/db";
import { hashPassword } from "@/lib/auth";
import { SCHEMA } from "@/lib/schema";

const bad = (error: string, status = 400) => NextResponse.json({ error }, { status });
const same = (a: string, b: string) => { const x = Buffer.from(a), y = Buffer.from(b); return x.length === y.length && timingSafeEqual(x, y); };
const MODS = ["hris", "finance", "crm", "ops", "budget"];

// Membuat tabel dan klien pertama dari browser. Dilindungi SETUP_KEY dan hanya berfungsi selama belum ada klien.
export async function POST(req: Request) {
  const key = process.env.SETUP_KEY;
  if (!key || key.length < 12) return bad("SETUP_KEY belum diisi di Vercel (minimal 12 karakter), atau belum di-Redeploy.", 503);
  const b = (await req.json().catch(() => null)) || {};
  if (!same(String(b.key || ""), key)) return bad("Kunci setup salah.", 403);
  const slug = String(b.slug || "").trim().toLowerCase(), tenant = String(b.tenant || "").trim(), hotel = String(b.hotel || "").trim();
  const city = String(b.city || "").trim(), username = String(b.username || "").trim().toLowerCase(), password = String(b.password || "");
  if (!/^[a-z0-9-]{2,30}$/.test(slug)) return bad("Kode klien 2-30 karakter: huruf kecil, angka, strip.");
  if (!tenant || !hotel) return bad("Nama klien dan nama hotel wajib diisi.");
  if (!/^[a-z0-9._-]{3,30}$/.test(username)) return bad("Username 3-30 karakter: huruf kecil, angka, titik, strip.");
  if (password.length < 10) return bad("Password minimal 10 karakter.");
  let tid = "";
  try {
    for (const st of SCHEMA) await sql.query(st);
    const [c] = await sql.query("select count(*)::int as n from tenants");
    if (c.n > 0) return bad("Setup sudah pernah dijalankan. Klien berikutnya didaftarkan lewat Aplikasi Lisensi atau skrip.", 403);
    const [t] = await sql.query("insert into tenants(slug,name) values($1,$2) returning id", [slug, tenant]); tid = t.id;
    const [h] = await sql.query("insert into hotels(tenant_id,name,city) values($1,$2,$3) returning id", [tid, hotel, city || null]);
    await sql.query("insert into users(tenant_id,username,pass_hash,role,hotel_ids) values($1,$2,$3,'owner',$4)", [tid, username, hashPassword(password), [h.id]]);
    const code = "CS-" + randomBytes(5).toString("hex").toUpperCase();
    const [l] = await sql.query("insert into licenses(tenant_id,code,expires_at) values($1,$2,current_date + 365) returning id", [tid, code]);
    for (const m of MODS) await sql.query("insert into license_modules(license_id,module) values($1,$2)", [l.id, m]);
    return NextResponse.json({ ok: true, slug, username, code });
  } catch (e) {
    if (tid) await sql.query("delete from tenants where id=$1", [tid]).catch(() => {});
    return bad("Gagal menyiapkan database: " + String((e as Error)?.message || e), 500);
  }
}
