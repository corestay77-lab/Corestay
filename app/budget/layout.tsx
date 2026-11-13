import { redirect } from "next/navigation";
import { currentUser, userModules } from "@/lib/data";
import "./budget.css";

export const dynamic = "force-dynamic";
const pill = { padding: "6px 11px", borderRadius: 99, background: "rgba(10,15,36,.92)", color: "#fff", font: "600 11px system-ui,sans-serif", textDecoration: "none", border: 0, cursor: "pointer" } as const;
export default async function BudgetLayout({ children }: { children: React.ReactNode }) {
  const s = await currentUser(); if (!s) redirect("/login");
  if (!(await userModules(s.tid, s.uid, s.role)).includes("budget")) redirect("/m/budget");
  return (
    <>
      {children}
      <div style={{ position: "fixed", left: 12, bottom: 12, zIndex: 50, display: "flex", gap: 6 }}>
        <a href="/" style={pill}>‹ Beranda</a>
        <form method="post" action="/api/logout" style={{ margin: 0 }}><button style={{ ...pill, background: "rgba(120,20,40,.92)" }}>Keluar</button></form>
      </div>
    </>
  );
}
