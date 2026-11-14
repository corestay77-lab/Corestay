// Logo kecil + nama, dipakai di bagian atas halaman.
export default function Brand({ suffix }: { suffix?: string }) {
  return (
    <span className="cs-brandrow">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/logo-icon.png" alt="" width={32} height={32} />
      <span className="cs-brand">CoreStay{suffix ? ` ${suffix}` : ""}</span>
    </span>
  );
}
