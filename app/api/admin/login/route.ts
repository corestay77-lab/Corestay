import { NextResponse } from "next/server";
import { ADMIN_COOKIE, adminConfigured, adminToken, adminTtl, checkAdmin } from "@/lib/admin";
import { clientIp, failLogin, lockedFor, okLogin } from "@/lib/throttle";

export async function POST(req: Request) {
  try {
    if (!adminConfigured()) return NextResponse.json({ error: "ADMIN_USER dan ADMIN_PASSWORD (min. 14 karakter) belum diisi di Vercel, atau belum di-Redeploy." }, { status: 503 });
    const ip = clientIp(req), b = await req.json().catch(() => null), u = String(b?.username || ""), p = String(b?.password || "");
    const wait = await lockedFor(ip, "admin");
    if (wait) return NextResponse.json({ error: `Terlalu banyak percobaan. Coba lagi dalam ${Math.ceil(wait / 60)} menit.` }, { status: 429 });
    if (!checkAdmin(u, p)) { await failLogin(ip, "admin"); return NextResponse.json({ error: "Username atau password salah." }, { status: 401 }); }
    await okLogin("admin");
    const res = NextResponse.json({ ok: true });
    res.cookies.set("csa", adminToken(u.trim().toLowerCase()), { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: adminTtl });
    return res;
  } catch (e) { console.error("admin login", e); return NextResponse.json({ error: "Server belum siap. Periksa DATABASE_URL dan SESSION_SECRET." }, { status: 500 }); }
}
