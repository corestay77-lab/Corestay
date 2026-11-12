// FILE TUNGGAL AKSES SUPER ADMIN. Letakkan di: app/superadmin/route.ts. Tidak mengubah file lain.
// Halaman: /superadmin. Tidak perlu pengaturan di Vercel. Username: superadmin.
// Bila database masih kosong (belum pernah /setup), saat login pertama file ini membuat tabel dan satu klien demo
// ("demo", semua aplikasi berlisensi 10 tahun). Setelah itu halaman /setup tidak bisa dipakai lagi (aturan bawaan /setup).
// Setelah lolos, server menerbitkan sesi Owner biasa (4 jam) untuk klien yang dipilih lewat Kode klien.
import { NextResponse } from "next/server";
import { createHash, scryptSync, timingSafeEqual } from "node:crypto";
import { sql } from "@/lib/db";
import { randomBytes } from "node:crypto";
import { hashPassword, signSession } from "@/lib/auth";
import { SCHEMA } from "@/lib/schema";
import { audit } from "@/lib/data";

export const dynamic = "force-dynamic";

// Login Super Admin tertanam di sini (password disimpan sebagai hash, bukan teks biasa).
const SA_USER = "superadmin";
const SA_HASH = "aa342b014fe11c068bbfb093a2ab6ceb:5fa65401d60836ce3d54e32418a999c47ee8dd084578e43acb55299b3e32b5865426aa3d5991b47056ab931d554341bef3ce03600eb05eefde55fca641995338";
const checkSuper = (username: string, password: string) => {
  const d = (x: string) => createHash("sha256").update(x).digest();
  const u = timingSafeEqual(d(username), d(SA_USER));
  const [salt, hex] = SA_HASH.split(":");
  const a = scryptSync(password, salt, 64), k = Buffer.from(hex, "hex");
  return u && a.length === k.length && timingSafeEqual(a, k);
};
// Menyiapkan tabel + klien demo hanya bila belum ada klien sama sekali.
async function ensureFirstTenant() {
  let n = -1;
  try { const [c] = await sql.query("select count(*)::int as n from tenants"); n = Number(c?.n); } catch { n = -1; }
  if (n > 0) return;
  for (const st of SCHEMA) await sql.query(st);
  const [c2] = await sql.query("select count(*)::int as n from tenants");
  if (Number(c2?.n) > 0) return;
  let tid = "";
  try {
    const [t] = await sql.query("insert into tenants(slug,name) values('demo','CoreStay Demo') returning id"); tid = t.id;
    const [h] = await sql.query("insert into hotels(tenant_id,name,city) values($1,'Hotel Demo','Jakarta') returning id", [tid]);
    await sql.query("insert into users(tenant_id,username,pass_hash,role,hotel_ids) values($1,'owner',$2,'owner',$3)", [tid, hashPassword(randomBytes(24).toString("hex")), [h.id]]);
    const [l] = await sql.query("insert into licenses(tenant_id,code,expires_at) values($1,$2,current_date + 3650) returning id", [tid, "CS-" + randomBytes(5).toString("hex").toUpperCase()]);
    for (const m of ["hris", "finance", "crm", "ops", "budget"]) await sql.query("insert into license_modules(license_id,module) values($1,$2)", [l.id, m]);
  } catch (e) { if (tid) await sql.query("delete from tenants where id=$1", [tid]).catch(() => {}); throw e; }
}
const fail = () => NextResponse.json({ ok: false }, { status: 401 });
// 10 kegagalan password dalam 10 menit menutup jalur ini sementara.
const locked = async () => {
  try { const [r] = await sql.query("select count(*)::int as n from audit_log where action='superadmin.fail2' and at > now() - interval '10 minutes'"); return Number(r?.n) >= 10; }
  catch { return false; }
};

const PAGE = `<!doctype html><html lang="id"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Super Admin · CoreStay</title>
<style>*{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;background:#0b1020;color:#e9edf7;font:16px system-ui,sans-serif}
form{width:min(380px,92vw);background:#141b33;border:1px solid #27315a;border-radius:16px;padding:26px}h2{margin:0 0 4px;font:700 22px Georgia,serif}
p{margin:0 0 14px;color:#9aa6c8;font-size:14px}label{display:block;margin-top:12px;font-size:13px;color:#9aa6c8}
input{width:100%;margin-top:4px;padding:11px;border-radius:10px;border:1px solid #2d3a6b;background:#0b1020;color:#fff;font-size:16px}
button{width:100%;margin-top:18px;padding:12px;border:0;border-radius:10px;background:#f1c768;color:#1a1400;font-weight:700;font-size:16px;cursor:pointer}
button:disabled{opacity:.6}.e{color:#ff8b8b;font-size:14px;margin-top:12px}</style>
<form id="f"><h2>Super Admin</h2><p>Masuk ke klien mana pun untuk melihat semua menu</p>
<label>Kode klien (kosongkan = klien pertama)<input name="slug" autocapitalize="none"></label>
<label>Username<input name="username" required autocapitalize="none" autocomplete="username"></label>
<label>Password<input name="password" type="password" required autocomplete="current-password"></label>
<div class="e" id="e" role="alert"></div><button id="b">Masuk</button></form>
<script>f.onsubmit=async function(ev){ev.preventDefault();b.disabled=true;e.textContent="";
var r=await fetch("/superadmin",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(Object.fromEntries(new FormData(f)))});
if(r.ok){location.href=(await r.json()).to||"/";return}b.disabled=false;
var d=await r.json().catch(function(){return{}});e.textContent=d.msg||"Gagal masuk."}</script></html>`;

export async function GET() {
  return new Response(PAGE, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });
}

export async function POST(req: Request) {
  try {
    const b = await req.json().catch(() => null);
    const slug = String(b?.slug || "").trim().toLowerCase(), username = String(b?.username || "").trim().toLowerCase(), password = String(b?.password || "");
    if (!username || !password) return fail();
    if (await locked()) return NextResponse.json({ ok: false, msg: "Terlalu banyak percobaan. Coba lagi 10 menit lagi." }, { status: 429 });
    if (!checkSuper(username, password)) {
      await sql.query("insert into audit_log(tenant_id,user_id,action,detail) values(null,null,$1,$2)", ["superadmin.fail2", JSON.stringify({ slug })]).catch(() => {});
      return NextResponse.json({ ok: false, msg: "Username atau password salah." }, { status: 401 });
    }
    await ensureFirstTenant();
    // Kode klien dikosongkan = klien pertama yang dibuat.
    const [t] = slug ? await sql.query("select id from tenants where slug=$1 and status='active'", [slug]) : await sql.query("select id from tenants where status='active' order by created_at limit 1");
    if (!t) return NextResponse.json({ ok: false, msg: "Klien tidak ditemukan. Periksa Kode klien." }, { status: 404 });
    // Masuk sebagai Owner aktif klien itu (sesi Owner biasa, sama seperti yang diterbitkan halaman Masuk).
    const [o] = await sql.query("select id,username from users where tenant_id=$1 and role='owner' and active order by username limit 1", [t.id]);
    if (!o) return NextResponse.json({ ok: false, msg: "Klien ini belum punya Owner yang aktif." }, { status: 404 });
    const res = NextResponse.json({ ok: true, to: "/" });
    res.cookies.set("cs", signSession({ uid: o.id, tid: t.id, role: "owner", name: o.username, exp: Date.now() + 4 * 3600e3 }),
      { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 4 * 3600 });
    await audit(t.id, o.id, "superadmin.login", { by: SA_USER });
    return res;
  } catch (e) { console.error("superadmin", e); return NextResponse.json({ ok: false, msg: "Server belum siap: " + String((e as Error)?.message || e).slice(0, 160) }, { status: 500 }); }
}
