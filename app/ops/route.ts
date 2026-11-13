import { currentUser, userModules } from "@/lib/data";
import { OPS_HTML } from "@/lib/ops/html";
import { getDoc, resolveHotel } from "@/lib/ops/store";
import { sql } from "@/lib/db";

// ---- Pemisahan tampilan per departemen (HK, Engineering, FO, dst.) ----
// Departemen diambil dari login (dipilih GM/Owner di Kelola tim). Akun lama tanpa departemen memakai Jabatan di Ops (Pengaturan > Tim).
// Menu departemen lain dinonaktifkan (abu-abu, tidak bisa dibuka). GM/Owner dan akun tanpa departemen/jabatan melihat semuanya.
// Patch mengubah teks halaman saat disajikan; bila satu penanda tidak ditemukan, patch itu dilewati dan Ops tetap jalan.
const swap = (h: string, from: string, to: string) => (h.includes(from) ? h.replace(from, () => to) : h);
const DEPT_JS = "const DEPT_OF={'Exec Housekeeper':'hk','HK Supervisor':'hk','Room Attendant':'hk','Public Area':'hk','Chief Engineer':'en','Technician':'en'},PG_DEPT={rooms:['hk','fo'],hk:['hk'],wo:['en'],pm:['en'],assets:['en']},DEPT_HOME={hk:'rooms',en:'wo',fo:'rooms'};\n"
  + "function curDept(){const w=(window.__CS||{}).me||{};return w.gm?'':(w.d||DEPT_OF[me().r]||'')}\n"
  + "function deptOK(p){const d=curDept(),a=PG_DEPT[p];return !d||!a||a.includes(d)}\n"
  + "function deptHome(){return DEPT_HOME[curDept()]||'dash'}\n";
function deptPatch(h: string) {
  h = swap(h, "function goTo(p){U.pg=p;", DEPT_JS + "function goTo(p){if(!deptOK(p)){toast('Menu ini khusus departemen lain');return}U.pg=p;");
  h = swap(h, "class=\"'+(U.pg==n[0]&&!U.gq?'on':'')+'\" aria-current=", "class=\"'+(U.pg==n[0]&&!U.gq?'on':'')+(deptOK(n[0])?'':' off')+'\" aria-disabled=\"'+(deptOK(n[0])?'false':'true')+'\" aria-current=");
  h = swap(h, "const k0=routeKey();if(k0)U.pg=k0;render();", "const k0=routeKey();U.pg=k0&&deptOK(k0)?k0:deptHome();render();");
  h = swap(h, "window.addEventListener('popstate',()=>{U.pg=routeKey()||'dash';", "window.addEventListener('popstate',()=>{{const k=routeKey();U.pg=k&&deptOK(k)?k:deptHome()}");
  // Akun departemen yang belum ditautkan ke anggota tim: HK/Engineering mendapat hak dasar, departemen lain hanya melihat.
  h = swap(h, "{id:'',n:w.u||'Tamu',r:'Viewer',on:1}", "{id:'',n:w.u||'Tamu',r:({hk:'Room Attendant',en:'Technician'})[w.d]||'Viewer',on:1}");
  return swap(h, "</head>", "<style>#nv a.off{opacity:.38;filter:grayscale(1);cursor:not-allowed}#nv a.off:hover{background:transparent}</style></head>");
}
const OPS_PAGE = deptPatch(OPS_HTML);

export const dynamic = "force-dynamic";
const go = (to: string) => new Response(null, { status: 302, headers: { Location: to } });
const page = (body: string) => new Response(`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><body style="font:16px system-ui;padding:32px;max-width:520px;margin:auto"><p>${body}</p><p><a href="/">‹ Semua aplikasi</a></p>`, { status: 409, headers: { "Content-Type": "text/html; charset=utf-8" } });

// Menyajikan aplikasi Ops hanya untuk pengguna berlisensi, dengan data hotel dan identitas login disisipkan dari server.
export async function GET(req: Request) {
  const s = await currentUser(); if (!s) return go("/login");
  if (!(await userModules(s.tid, s.uid, s.role)).includes("ops")) return go("/m/ops");
  const { hotel, hotels } = await resolveHotel(s, new URL(req.url).searchParams.get("h"));
  if (!hotel) return page("Akun Anda belum ditetapkan ke sebuah hotel, atau klien ini belum punya hotel. Hubungi Owner.");
  const doc = await getDoc(s.tid, hotel.id);
  let dept = "";
  if (s.role === "staff") { const [u] = await sql.query("select modules from users where id=$1 and tenant_id=$2", [s.uid, s.tid]); dept = ((u?.modules as string[]) || []).find((m) => m.startsWith("dept:"))?.slice(5) || ""; }
  const boot = { state: doc?.data ?? null, version: doc?.version ?? 0, hotel, hotels, me: { u: s.name.toLowerCase(), gm: s.role !== "staff", d: dept } };
  const js = "window.__CS=" + JSON.stringify(boot).replace(/</g, "\\u003c").replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029") + ";";
  return new Response(OPS_PAGE.replace("/*__CS__*/", () => js), { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });
}
