import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { sql } from "@/lib/db";
import { adminSession } from "@/lib/admin";
import { hashPassword } from "@/lib/auth";
import { audit } from "@/lib/data";
import { MOD_KEYS } from "@/lib/tenants";

const bad = (error: string, status = 400) => NextResponse.json({ error }, { status });
const isDate = (v: unknown) => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) && !isNaN(Date.parse(v));

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await adminSession())) return bad("Sesi admin berakhir. Masuk lagi.", 401);
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) return bad("ID tidak valid.");
  if (!(await sql.query("select 1 from tenants where id=$1", [id])).length) return bad("Klien tidak ditemukan.", 404);
  const b = (await req.json().catch(() => null)) || {};
  try {
    if (b.action === "license") {
      const mods = (Array.isArray(b.modules) ? b.modules : []).filter((m: string) => MOD_KEYS.includes(m));
      if (!mods.length) return bad("Pilih minimal satu modul.");
      if (b.expires && !isDate(b.expires)) return bad("Tanggal berakhir tidak valid.");
      let [l] = await sql.query("select id from licenses where tenant_id=$1 and status='active' order by expires_at desc nulls first limit 1", [id]);
      if (!l) [l] = await sql.query("insert into licenses(tenant_id,code) values($1,$2) returning id", [id, "CS-" + randomBytes(5).toString("hex").toUpperCase()]);
      await sql.query("update licenses set expires_at=$1::date, status='active' where id=$2", [b.expires || null, l.id]);
      await sql.query("update licenses set status='inactive' where tenant_id=$1 and id<>$2", [id, l.id]);
      await sql.query("delete from license_modules where license_id=$1", [l.id]);
      for (const m of mods) await sql.query("insert into license_modules(license_id,module) values($1,$2)", [l.id, m]);
      await audit(id, null, "admin.license", { mods, expires: b.expires || null });
    } else if (b.action === "status") {
      if (!["active", "suspended"].includes(b.status)) return bad("Status tidak valid.");
      await sql.query("update tenants set status=$1 where id=$2", [b.status, id]);
      await audit(id, null, "admin.status", { status: b.status });
    } else if (b.action === "hotel") {
      const name = String(b.name || "").trim(); if (!name) return bad("Nama hotel wajib diisi.");
      if ((await sql.query("select 1 from hotels where tenant_id=$1 and lower(name)=lower($2)", [id, name])).length) return bad("Nama hotel sudah ada.", 409);
      await sql.query("insert into hotels(tenant_id,name,city) values($1,$2,$3)", [id, name, String(b.city || "").trim() || null]);
      await audit(id, null, "admin.hotel", { name });
    } else if (b.action === "reset") {
      const p = String(b.password || ""); if (p.length < 10) return bad("Password minimal 10 karakter.");
      if (!/^[0-9a-f-]{36}$/.test(String(b.userId || ""))) return bad("Pengguna tidak valid.");
      const r = await sql.query("update users set pass_hash=$1 where id=$2 and tenant_id=$3 returning id", [hashPassword(p), b.userId, id]);
      if (!r.length) return bad("Pengguna tidak ditemukan.", 404);
      await audit(id, null, "admin.reset", { user: b.userId });
    } else if (b.action === "owner") {
      const u = String(b.username || "").trim().toLowerCase(), p = String(b.password || "");
      if (!/^[a-z0-9._-]{3,30}$/.test(u)) return bad("Username 3-30 karakter: huruf kecil, angka, titik, strip.");
      if (p.length < 10) return bad("Password minimal 10 karakter.");
      try { await sql.query("insert into users(tenant_id,username,pass_hash,role) values($1,$2,$3,'owner')", [id, u, hashPassword(p)]); }
      catch { return bad("Username sudah dipakai.", 409); }
      await audit(id, null, "admin.owner", { username: u });
    } else return bad("Aksi tidak dikenal.");
    return NextResponse.json({ ok: true });
  } catch (e) { console.error("admin client", e); return bad("Gagal menyimpan: " + String((e as Error).message || e), 500); }
}
