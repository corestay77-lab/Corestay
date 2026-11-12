import { currentUser, userModules } from "@/lib/data";
import { CRM_HTML } from "@/lib/crm/html";
import { getDoc, resolveHotel } from "@/lib/crm/store";

export const dynamic = "force-dynamic";
const go = (to: string) => new Response(null, { status: 302, headers: { Location: to } });
const page = (body: string) => new Response(`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><body style="font:16px system-ui;padding:32px;max-width:520px;margin:auto"><p>${body}</p><p><a href="/">‹ Semua aplikasi</a></p>`, { status: 409, headers: { "Content-Type": "text/html; charset=utf-8" } });

// Menyajikan aplikasi Sales CRM hanya untuk pengguna berlisensi, dengan data hotel dan identitas login disisipkan dari server.
export async function GET(req: Request) {
  const s = await currentUser(); if (!s) return go("/login");
  if (!(await userModules(s.tid, s.uid, s.role)).includes("crm")) return go("/m/crm");
  const { hotel, hotels } = await resolveHotel(s, new URL(req.url).searchParams.get("h"));
  if (!hotel) return page("Akun Anda belum ditetapkan ke sebuah hotel, atau klien ini belum punya hotel. Hubungi Owner.");
  const doc = await getDoc(s.tid, hotel.id);
  const boot = { state: doc?.data ?? null, version: doc?.version ?? 0, hotel, hotels, me: { u: s.name.toLowerCase(), gm: s.role !== "staff" } };
  const js = "window.__CS=" + JSON.stringify(boot).replace(/</g, "\\u003c").replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029") + ";";
  return new Response(CRM_HTML.replace("/*__CS__*/", () => js), { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });
}
