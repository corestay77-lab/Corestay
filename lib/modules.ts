export const MODULES: Record<string, { name: string; short: string; icon: string; color: string; href: string; desc: string; ready: boolean }> = {
  hris: { name: "HRIS & Payroll", short: "HRIS", icon: "👥", color: "#ff7aa0", href: "/hris", desc: "Karyawan, absensi QR, jadwal, payroll, dan labor cost", ready: true },
  finance: { name: "Finance", short: "Finance", icon: "💰", color: "#3be0a8", href: "/finance", desc: "Invoice, piutang, utang, kas, dan laporan keuangan", ready: true },
  crm: { name: "Sales CRM", short: "CRM", icon: "🤝", color: "#6ea0ff", href: "/crm", desc: "Prospek, penawaran, kontrak, dan reputasi tamu", ready: true },
  ops: { name: "Ops · Housekeeping & Engineering", short: "Ops", icon: "🛎️", color: "#a98bff", href: "/ops", desc: "Status kamar, work order, preventive maintenance, utilitas", ready: true },
  budget: { name: "Hotel Budget", short: "Budget", icon: "📊", color: "#f5c04a", href: "/budget", desc: "Anggaran, proyeksi, dan laporan final", ready: true },
};
