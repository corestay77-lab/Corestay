import { currentUser, tenantInfo, userModules } from "@/lib/data";
import { FINANCE_HTML } from "@/lib/finance/html";
import { getDoc } from "@/lib/finance/store";

export const dynamic = "force-dynamic";
const go = (to: string) => new Response(null, { status: 302, headers: { Location: to } });

// Menyajikan aplikasi Finance hanya untuk pengguna berlisensi, dengan data klien dan daftar hotel disisipkan dari server.
export async function GET() {
  const s = await currentUser(); if (!s) return go("/login");
  if (!(await userModules(s.tid, s.uid, s.role)).includes("finance")) return go("/m/finance");
  const [t, doc] = await Promise.all([tenantInfo(s.tid), getDoc(s.tid)]);
  const boot = { state: doc?.data ?? null, version: doc?.version ?? 0, hotels: (t?.hotels || []).map((h) => h.name) };
  const js = "window.__CS=" + JSON.stringify(boot).replace(/</g, "\\u003c").replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029") + ";";
  return new Response(FINANCE_HTML.replace("/*__CS__*/", () => js), { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });
}
