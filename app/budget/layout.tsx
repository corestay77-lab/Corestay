import { redirect } from "next/navigation";
import { currentUser, userModules } from "@/lib/data";
import "./budget.css";

export const dynamic = "force-dynamic";
export default async function BudgetLayout({ children }: { children: React.ReactNode }) {
  const s = await currentUser(); if (!s) redirect("/login");
  if (!(await userModules(s.tid, s.uid, s.role)).includes("budget")) redirect("/m/budget");
  return (
    <>
      {children}
      <a href="/" style={{ position: "fixed", left: 12, bottom: 12, zIndex: 50, padding: "7px 13px", borderRadius: 99, background: "rgba(10,15,36,.92)", color: "#fff", font: "600 12px system-ui,sans-serif", textDecoration: "none" }}>‹ Semua aplikasi</a>
    </>
  );
}
