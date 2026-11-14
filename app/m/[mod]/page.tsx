import Link from "next/link";
import Brand from "@/components/Brand";
import { redirect } from "next/navigation";
import { currentUser, userModules } from "@/lib/data";
import { MODULES } from "@/lib/modules";

export default async function Mod({ params }: { params: Promise<{ mod: string }> }) {
  const { mod } = await params;
  const s = await currentUser(); if (!s) redirect("/login");
  const m = MODULES[mod];
  const ok = !!m && (await userModules(s.tid, s.uid, s.role)).includes(mod);
  if (ok && m.ready && m.href !== `/m/${mod}`) redirect(m.href);
  return (
    <div className="cs-page"><main className="cs-wrap">
      <div className="cs-top"><Link href="/" className="cs-ghost">‹ Beranda</Link><Brand /></div>
      <section className="cs-hero" style={{ ["--c" as string]: m?.color }}>
        <h1>{ok ? `${m.icon} ${m.name}` : "Tidak ada akses"}</h1>
        <p>{ok ? "Aplikasi ini sedang dipindahkan ke platform CoreStay. Akan tersedia di sini setelah penggabungan selesai." : "Aplikasi ini belum aktif pada lisensi atau belum diberikan ke akun Anda. Hubungi admin hotel."}</p>
      </section>
    </main></div>
  );
}
