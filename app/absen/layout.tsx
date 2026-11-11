import "../hris/hris.css";

// Halaman absen karyawan (lewat QR): publik, tanpa login CoreStay.
export default function AbsenLayout({ children }: { children: React.ReactNode }) {
  return <div className="hris-root">{children}</div>;
}
