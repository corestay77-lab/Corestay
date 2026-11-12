import { budgetSession } from "@/lib/budget/guard";
import { NextResponse } from "next/server";
import { generateObject } from "ai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { z } from "zod";

export const runtime = "nodejs";
export const maxDuration = 60;

const ValidationResult = z.object({
  passed: z.boolean(),
  issues: z.array(z.string()).max(12),
  warnings: z.array(z.string()).max(12),
  summary: z.string().max(500),
});

const n = (value: unknown) => {
  if (value === "" || value === null || value === undefined) return 0;
  const result = Number(value);
  return Number.isFinite(result) ? result : Number.NaN;
};

export async function POST(request: Request) {
  if (!(await budgetSession())) return NextResponse.json({ error: "Silakan login kembali atau minta akses Hotel Budget." }, { status: 401 });
  try {
    const body = await request.json();
    const form = body?.form;
    const calculated = body?.calculated;
    if (!form || typeof form !== "object" || !calculated || typeof calculated !== "object") {
      return NextResponse.json({ passed: false, issues: ["Payload form atau hasil kalkulasi tidak valid."], warnings: [], error: "Data validasi tidak lengkap." }, { status: 400 });
    }

    const issues: string[] = [];
    const warnings: string[] = [];
    const days = n(form.days);
    const rooms = n(form.rooms);
    const roomSold = n(form.roomSold);
    const roomAvailable = days * rooms;
    const revenue = n(form.roomRevenue) + n(form.fbRevenue) + n(form.otherRevenue);
    const costs = n(form.costOfSales) + n(form.payroll) + n(form.departmentalExpense) + n(form.overhead);
    const gop = revenue - costs;
    if (!String(form.hotelName || "").trim()) issues.push("Nama hotel wajib diisi.");
    if (!String(form.period || "").trim()) issues.push("Periode laporan wajib diisi.");
    if (!(days > 0) || !(rooms > 0)) issues.push("Hari operasional dan jumlah kamar harus lebih dari nol.");
    if (roomSold < 0 || roomSold > roomAvailable) issues.push("Room nights terjual tidak sesuai dengan kapasitas tersedia.");
    for (const key of ["roomRevenue","fbRevenue","otherRevenue","costOfSales","payroll","departmentalExpense","overhead","depreciation","interest","tax"]) {
      const value = n(form[key]);
      if (!Number.isFinite(value) || value < 0) issues.push("Nilai " + key + " harus berupa angka valid dan tidak negatif.");
    }
    const close = (a: unknown, b: number) => Number.isFinite(Number(a)) && Math.abs(Number(a) - b) <= Math.max(1, Math.abs(b) * 0.000001);
    if (!close(calculated.roomAvailable, roomAvailable)) issues.push("Room Available tidak cocok dengan hari operasional × jumlah kamar.");
    if (!close(calculated.revenue, revenue)) issues.push("Total Revenue tidak cocok dengan penjumlahan komponen pendapatan.");
    if (!close(calculated.costs, costs)) issues.push("Total biaya tidak cocok dengan penjumlahan komponen biaya.");
    if (!close(calculated.gop, gop)) issues.push("GOP tidak cocok dengan Total Revenue − komponen biaya yang diisi.");
    if (String(form.budgetRevenue || "").trim() && n(form.budgetRevenue) < 0) issues.push("Budget Revenue tidak boleh negatif.");
    if (String(form.budgetExpense || "").trim() && n(form.budgetExpense) < 0) issues.push("Budget Expense tidak boleh negatif.");
    if (String(form.cash || "").trim() && !Number.isFinite(n(form.cash))) issues.push("Nilai cash harus berupa angka yang valid.");
    if (!String(form.budgetRevenue || "").trim()) warnings.push("Budget Revenue belum diisi; revenue variance tidak dapat dihitung.");
    if (!String(form.budgetExpense || "").trim()) warnings.push("Budget Expense belum diisi; cost variance tidak dapat dihitung.");
    if (revenue === 0) warnings.push("Total revenue masih nol/kosong. Periksa kelengkapan input sebelum menggunakan hasil.");
    if (!String(form.notes || "").trim()) warnings.push("Catatan atau penjelasan asumsi belum diisi.");

    if (issues.length) {
      return NextResponse.json({ passed: false, issues, warnings, summary: "Validasi aturan dan rekonsiliasi dasar gagal. Data belum disimpan." });
    }
    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json({ passed: false, issues: ["GEMINI_API_KEY tidak tersedia di server; AI Orchestrator tidak dapat dijalankan."], warnings, error: "Validasi final AI belum tersedia. Data belum disimpan." }, { status: 503 });
    }

    const google = createGoogleGenerativeAI({ apiKey: process.env.GEMINI_API_KEY });
    const prompt = `Lakukan final validation untuk input Hotel Budget & P&L CoreStay. Jangan membuat angka atau asumsi baru. Cek aritmetika, konsistensi statistik hotel, kapasitas kamar, klasifikasi GOP, budget variance, dan apakah angka kosong disamarkan sebagai nol. Input (JSON): ${JSON.stringify({ form, calculated: { roomAvailable, revenue, costs, gop, occupancy: roomAvailable > 0 ? roomSold / roomAvailable * 100 : null, adr: roomSold > 0 ? n(form.roomRevenue) / roomSold : null, revpar: roomAvailable > 0 ? n(form.roomRevenue) / roomAvailable : null } })}. Nilai cash adalah field sumber dan jangan mengasumsikannya sebagai cash flow bila label sumber tidak jelas. Jika ada kesalahan material, passed=false dan issues berisi hal yang spesifik. Warning boleh digunakan untuk data yang tidak lengkap tetapi bukan kesalahan aritmetika. Jangan mengubah input. Ringkasan singkat dalam Bahasa Indonesia profesional.`;
    let finalReview: z.infer<typeof ValidationResult> | null = null;
    let lastError: unknown = null;
    for (const modelId of ["gemini-3.8-flash", "gemini-3.5-flash-lite"]) {
      try {
        const result = await generateObject({
          model: google(modelId),
          schema: ValidationResult,
          system: "Anda adalah CORESTAY HOTEL BUDGET ORCHESTRATOR, reviewer validasi akhir yang ketat dan berbasis bukti. Periksa data, jangan pernah mengarang. Bila ragu terhadap kesalahan material, tolak dan jelaskan. Anda tidak boleh mengubah angka input.",
          prompt,
          maxRetries: 0,
          abortSignal: AbortSignal.timeout(18000),
        });
        finalReview = result.object;
        break;
      } catch (error) {
        lastError = error;
        console.error("Hotel budget orchestrator failed:", modelId, error);
      }
    }
    if (!finalReview) {
      console.error("All Hotel Budget Orchestrator models failed:", lastError);
      return NextResponse.json({ passed: false, issues: ["AI Orchestrator tidak berhasil menyelesaikan review final. Data belum disimpan."], warnings, error: "Layanan AI sedang sibuk. Silakan coba lagi; data input tetap berada pada form ini." }, { status: 503 });
    }
    const allIssues = [...new Set([...issues, ...finalReview.issues])];
    const allWarnings = [...new Set([...warnings, ...finalReview.warnings])];
    const passed = finalReview.passed === true && allIssues.length === 0;
    return NextResponse.json({
      passed,
      issues: allIssues,
      warnings: allWarnings,
      summary: finalReview.summary,
      orchestrator: { name: "CORESTAY HOTEL BUDGET ORCHESTRATOR", completed: true, modelsReviewed: true, deterministicChecks: true },
    });
  } catch (error) {
    console.error("Hotel budget validation error:", error);
    return NextResponse.json({ passed: false, issues: [error instanceof Error ? error.message : "Validasi server gagal."], warnings: [], error: "Validasi final gagal. Data belum disimpan." }, { status: 500 });
  }
}
