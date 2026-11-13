import Link from "next/link";
import { redirect } from "next/navigation";
import { adminSession } from "@/lib/admin";
import { MODULES } from "@/lib/modules";
import NewClient from "./NewClient";

export default async function New() {
  if (!(await adminSession())) redirect("/admin/login");
  const mods = Object.entries(MODULES).map(([k, m]) => [k, m.name] as [string, string]);
  return (
    <div className="cs-page"><main className="cs-wrap" style={{ maxWidth: 560 }}>
      <div className="cs-top"><Link href="/admin" className="cs-ghost">‹ Daftar klien</Link><span className="cs-brand">CoreStay Lisensi</span></div>
      <NewClient mods={mods} />
    </main></div>
  );
}
