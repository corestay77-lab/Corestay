import { redirect } from "next/navigation";
import { currentUser, userModules } from "@/lib/data";
import "./hris.css";

export const dynamic = "force-dynamic";
export default async function HrisLayout({ children }: { children: React.ReactNode }) {
  const s = await currentUser(); if (!s) redirect("/login");
  if (!(await userModules(s.tid, s.uid, s.role)).includes("hris")) redirect("/m/hris");
  return <div className="hris-root">{children}</div>;
}
