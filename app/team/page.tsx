import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/data";
import { MODULES } from "@/lib/modules";
import TeamClient from "./TeamClient";

export default async function Team() {
  const s = await currentUser(); if (!s) redirect("/login");
  if (s.role === "staff") redirect("/");
  const names = Object.fromEntries(Object.entries(MODULES).map(([k, m]) => [k, m.short]));
  return (
    <div className="cs-page"><main className="cs-wrap">
      <div className="cs-top"><Link href="/" className="cs-ghost">‹ Beranda</Link><span className="cs-brand">CoreStay</span></div>
      <section className="cs-hero"><h1>Tim hotel</h1><p>Buat login untuk Housekeeping, Engineering, Sales, dan tim lain. Tiap login langsung masuk ke aplikasi yang Anda pilihkan.</p></section>
      <TeamClient names={names} />
    </main></div>
  );
}
