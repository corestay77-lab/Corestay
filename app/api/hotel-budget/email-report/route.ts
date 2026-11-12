import { budgetSession } from "@/lib/budget/guard";
import { del, get } from "@vercel/blob";
import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";

export const runtime = "nodejs";
export const maxDuration = 60;
const MAX_PDF_BYTES = 25 * 1024 * 1024;

export async function POST(request: NextRequest) {
  if (!(await budgetSession())) return NextResponse.json({ error: "Silakan login kembali atau minta akses Hotel Budget." }, { status: 401 });
  let uploadedPathname = "";
  try {
    const apiKey = process.env.RESEND_API_KEY;
    const from = process.env.HOTEL_BUDGET_EMAIL_FROM;
    if (!apiKey || !from) {
      return NextResponse.json({ success: false, error: "Pengiriman email belum dikonfigurasi. Admin perlu mengatur RESEND_API_KEY dan HOTEL_BUDGET_EMAIL_FROM di Vercel." }, { status: 503 });
    }

    const body = await request.json();
    const to = typeof body?.to === "string" ? body.to.trim() : "";
    const hotelName = typeof body?.hotelName === "string" ? body.hotelName.trim().slice(0, 180) : "Hotel";
    const period = typeof body?.period === "string" ? body.period.trim().slice(0, 100) : "";
    const yearStart = typeof body?.yearStart === "string" || typeof body?.yearStart === "number" ? String(body.yearStart).slice(0, 4) : "";
    const fileName = typeof body?.fileName === "string" ? body.fileName.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120) : "CoreStay-Hotel-Budget.pdf";
    uploadedPathname = typeof body?.blobPathname === "string" ? body.blobPathname : "";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
      return NextResponse.json({ success: false, error: "Alamat email penerima tidak valid." }, { status: 400 });
    }
    if (!uploadedPathname.startsWith("hotel-budget-email-reports/") || uploadedPathname.includes("..")) {
      return NextResponse.json({ success: false, error: "File unggahan tidak ditemukan atau tidak valid. Silakan unggah PDF kembali." }, { status: 400 });
    }

    const blob = await get(uploadedPathname, { access: "private" });
    if (!blob || blob.statusCode !== 200 || !blob.stream) {
      return NextResponse.json({ success: false, error: "PDF sementara tidak dapat dibaca. Silakan unggah ulang file PDF." }, { status: 404 });
    }
    const pdf = Buffer.from(await new Response(blob.stream).arrayBuffer());
    if (pdf.length > MAX_PDF_BYTES || pdf.length < 5 || pdf.subarray(0, 5).toString("ascii") !== "%PDF-") {
      return NextResponse.json({ success: false, error: "Lampiran bukan file PDF yang valid atau ukurannya melebihi 25 MB." }, { status: 400 });
    }

    const safeHotel = (hotelName || "Hotel").replace(/[<>&"]/g, "");
    const safePeriod = (period || yearStart || "—").replace(/[<>&"]/g, "");
    const resend = new Resend(apiKey);
    const result = await resend.emails.send({
      from,
      to: [to],
      subject: "Laporan Akhir Hotel Budget — " + safeHotel + (period ? " · " + period : ""),
      html: `<div style="font-family:Arial,sans-serif;color:#172033;line-height:1.6"><h2 style="color:#17365D">CORESTAY ADVISORY</h2><p>Yth. Penerima,</p><p>Terlampir laporan akhir <strong>Hotel Budget &amp; Financial Report</strong> untuk <strong>${safeHotel}</strong>, periode ${safePeriod}.</p><p>Dokumen PDF ini dikirim sesuai file yang dipilih dari Preview / Print PDF.</p><p>Hormat kami,<br/><strong>CoreStay Advisory</strong></p><p style="font-size:11px;color:#64748b">Dokumen ini bersifat rahasia dan ditujukan untuk penerima yang tercantum.</p></div>`,
      attachments: [{ filename: fileName.toLowerCase().endsWith(".pdf") ? fileName : fileName + ".pdf", content: pdf }]
    });
    if (result.error) {
      console.error("CoreStay Hotel Budget email failed:", result.error);
      return NextResponse.json({ success: false, error: "Email tidak berhasil dikirim. Periksa konfigurasi pengirim dan domain email di Resend." }, { status: 502 });
    }
    return NextResponse.json({ success: true, id: result.data?.id });
  } catch (error) {
    console.error("CoreStay Hotel Budget email route failed:", error);
    const message = error instanceof Error && /BLOB_READ_WRITE_TOKEN|token/i.test(error.message)
      ? "Penyimpanan PDF belum siap. Pastikan private Blob store terhubung ke proyek Vercel."
      : "Terjadi kesalahan saat mengirim email laporan.";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  } finally {
    if (uploadedPathname.startsWith("hotel-budget-email-reports/")) {
      try {
        await del(uploadedPathname);
      } catch (cleanupError) {
        console.error("CoreStay temporary PDF cleanup failed:", cleanupError);
      }
    }
  }
}
