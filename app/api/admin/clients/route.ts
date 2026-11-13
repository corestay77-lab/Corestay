import { NextResponse } from "next/server";
import { adminSession } from "@/lib/admin";
import { createTenant } from "@/lib/tenants";

export async function POST(req: Request) {
  if (!(await adminSession())) return NextResponse.json({ error: "Sesi admin berakhir. Masuk lagi." }, { status: 401 });
  const b = (await req.json().catch(() => null)) || {};
  try {
    const r = await createTenant({ slug: String(b.slug || ""), name: String(b.name || ""), hotel: String(b.hotel || ""), city: String(b.city || ""), username: String(b.username || ""), password: String(b.password || ""), modules: Array.isArray(b.modules) ? b.modules : [], days: Number(b.days) || 365 });
    return NextResponse.json({ ok: true, ...r });
  } catch (e) { return NextResponse.json({ error: String((e as Error).message || e) }, { status: 400 }); }
}
