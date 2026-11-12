import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { budgetSession, ensureBudgetTable } from "@/lib/budget/guard";
import { generateObject } from "ai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { z } from "zod";
import { ACCOUNT_LINES, calculateBudget, numeric, sumGroup } from "@/lib/budget/hotel-budget-final";

export const runtime = "nodejs";
export const maxDuration = 60;
const ReviewSchema = z.object({
  passed: z.boolean(),
  issues: z.array(z.string()).max(15),
  warnings: z.array(z.string()).max(15),
  summary: z.string().max(500)
});

const isValidIsoDate = (value: unknown) => {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
};

async function authenticatedClient(_request: NextRequest) {
  const s = await budgetSession();
  if (!s) return { error: NextResponse.json({ error: "Silakan login kembali atau minta akses Hotel Budget." }, { status: 401 }) };
  await ensureBudgetTable();
  return { s };
}

export async function GET(request: NextRequest) {
  const auth = await authenticatedClient(request);
  if ("error" in auth) return auth.error;
  let data: any[] = [], error: unknown = null;
  try {
    // Owner dan GM melihat semua laporan klien; staf hanya laporan buatannya sendiri.
    data = await sql.query("select id,file_name,report_json,created_at from budget_report where tenant_id=$1 and ($2::boolean or user_id=$3) order by created_at desc limit 25", [auth.s.tid, auth.s.role !== "staff", auth.s.uid]);
  } catch (e) { error = e; }
  if (error) {
    console.error("Hotel budget report read failed:", error);
    return NextResponse.json({ error: "Laporan belum dapat dibaca. Coba lagi atau hubungi admin." }, { status: 503 });
  }
  const reports = (data || []).map((row: any) => ({ id: row.id, hotel_name: row.report_json?.form_data?.hotelName || row.file_name || "Hotel", period_label: row.report_json?.form_data?.period || "", calculated_data: row.report_json?.calculated_data || {}, validation_data: row.report_json?.validation_data || {}, created_at: row.created_at, form_data: row.report_json?.form_data || {} }));
  return NextResponse.json({ reports });
}

export async function DELETE(request: NextRequest) {
  const auth = await authenticatedClient(request);
  if ("error" in auth) return auth.error;
  const id = request.nextUrl.searchParams.get("id");
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "ID laporan tidak valid." }, { status: 400 });
  let data: { id: string } | null = null, error: unknown = null;
  try {
    const r = await sql.query("delete from budget_report where id=$1 and tenant_id=$2 and ($3::boolean or user_id=$4) returning id", [id, auth.s.tid, auth.s.role !== "staff", auth.s.uid]);
    data = (r[0] as { id: string }) || null;
  } catch (e) { error = e; }
  if (error) {
    console.error("Hotel budget report delete failed:", error);
    return NextResponse.json({ error: "Laporan tidak dapat dihapus." }, { status: 500 });
  }
  if (!data) return NextResponse.json({ error: "Laporan tidak ditemukan atau bukan milik akun ini." }, { status: 404 });
  return NextResponse.json({ success: true });
}

export async function POST(request: NextRequest) {
  const auth = await authenticatedClient(request);
  if ("error" in auth) return auth.error;
  try {
    const contentLength = Number(request.headers.get("content-length") || 0);
    if (contentLength > 1_500_000) return NextResponse.json({ error: "Data form terlalu besar." }, { status: 413 });
    const body = await request.json();
    const form = body?.form;
    if (!form || typeof form !== "object" || Array.isArray(form) || typeof form.hotelName !== "string" || typeof form.period !== "string" || !form.statistics || !form.accounts) {
      return NextResponse.json({ error: "Struktur form tidak valid." }, { status: 400 });
    }
    if (JSON.stringify(form).length > 1_500_000) return NextResponse.json({ error: "Data form terlalu besar." }, { status: 413 });
    const hotelName = form.hotelName.trim().slice(0, 180);
    const period = form.period.trim().slice(0, 100);
    if (!hotelName || !period) return NextResponse.json({ passed: false, issues: ["Nama hotel dan periode wajib diisi."], warnings: [] }, { status: 422 });
    const stats = form.statistics;
    const yearStart = numeric(form.yearStart);
    if (yearStart === null || !Number.isInteger(yearStart) || yearStart < 1900 || yearStart > 2200) return NextResponse.json({ passed:false, issues:["Tahun awal forecast harus berupa tahun valid antara 1900–2200."], warnings:[] }, { status:422 });
    const days = numeric(stats.days), rooms = numeric(stats.rooms);
    if (days === null || !Number.isInteger(days) || days <= 0 || days > 366) return NextResponse.json({ passed: false, issues: ["Hari operasional harus berupa bilangan bulat antara 1–366."], warnings: [] }, { status: 422 });
    if (rooms === null || !Number.isInteger(rooms) || rooms <= 0 || rooms > 100000) return NextResponse.json({ passed: false, issues: ["Jumlah kamar harus berupa bilangan bulat positif yang masuk akal."], warnings: [] }, { status: 422 });
    const totalRoomBuild = days * rooms;
    const issues: string[] = [];
    const warnings: string[] = [];
    // Lima statistik room-night tidak lagi memiliki kolom input di Step 1.
    // Karena itu nilainya opsional; jika nilai lama/tersimpan tersedia, tetap validasi.
    const statKeys = ["outInventory","houseUse","outOfOrder","complimentary","roomPaid"] as const;
    for (const key of statKeys) {
      const raw = stats[key];
      if (raw === "" || raw === null || raw === undefined) continue;
      if (numeric(raw) === null) issues.push("Statistik "+key+" harus berupa angka yang valid.");
      else if (!Number.isInteger(numeric(raw))) issues.push("Statistik "+key+" harus berupa bilangan bulat room-night.");
    }
    const fnbNumericKeys = ["occupancy","exchangeRate","averageSellingRate","modBusinessCenterRevenue","modMassageRevenue","modLaundryRevenue","modOtherIncomeRevenue","fbAverageGuestsPerRoom","fbLengthOfStay","fbRestaurantCoverPercent","fbAverageBreakfastCheck","fbMeetingRoomAUnits","fbMeetingRoomAPax","fbMeetingRoomACoverPercent","fbMeetingRoomBUnits","fbMeetingRoomBPax","fbMeetingRoomBCoverPercent","fbMeetingRoomOperatingDays","fbBallroomCapacity","fbBallroomCoverPercent","fbBallroomEventsPerYear","fbAverageMeetingCheck"];
    for (const key of fnbNumericKeys) {
      const raw = stats[key];
      if (raw === "" || raw === null || raw === undefined) continue;
      const value = numeric(raw);
      if (value === null || value < 0) issues.push("Asumsi " + key + " harus berupa angka valid dan tidak negatif.");
      else if (key.toLowerCase().includes("coverpercent") && value > 100) issues.push("Asumsi " + key + " tidak boleh melebihi 100%.");
      else if (["fbMeetingRoomOperatingDays","fbBallroomEventsPerYear"].includes(key) && !Number.isInteger(value)) issues.push("Asumsi " + key + " harus berupa bilangan bulat.");
      else if (key === "fbMeetingRoomOperatingDays" && value > (new Date(Number(form.yearStart), 0, 1).getFullYear() % 4 === 0 && (new Date(Number(form.yearStart), 0, 1).getFullYear() % 100 !== 0 || new Date(Number(form.yearStart), 0, 1).getFullYear() % 400 === 0) ? 366 : 365)) issues.push("Hari operasional meeting room tidak boleh melebihi jumlah hari dalam tahun forecast.");
      else if (key === "fbLengthOfStay" && value <= 0) issues.push("Length of Stay harus lebih besar dari nol.");
    }
    const additionalMeetingRooms = Array.isArray(stats.fbAdditionalMeetingRooms) ? stats.fbAdditionalMeetingRooms : [];
    for (const [index, room] of additionalMeetingRooms.entries()) {
      for (const key of ["units","paxPerUnit","coverPercent"]) {
        const raw = room?.[key];
        if (raw === "" || raw === null || raw === undefined) continue;
        const value = numeric(raw);
        if (value === null || value < 0) issues.push("Meeting room tambahan " + (index + 1) + " — " + key + " harus berupa angka valid dan tidak negatif.");
        else if (key === "coverPercent" && value > 100) issues.push("Meeting room tambahan " + (index + 1) + " — cover tidak boleh melebihi 100%.");
        else if (["units","paxPerUnit"].includes(key) && !Number.isInteger(value)) issues.push("Meeting room tambahan " + (index + 1) + " — " + key + " harus bilangan bulat.");
      }
    }
    const meetingRoomConfigured = ["fbMeetingRoomAUnits","fbMeetingRoomAPax","fbMeetingRoomACoverPercent","fbMeetingRoomBUnits","fbMeetingRoomBPax","fbMeetingRoomBCoverPercent"].some(key => numeric(stats[key]) !== null) || additionalMeetingRooms.some((room: Record<string, unknown>) => ["units","paxPerUnit","coverPercent"].some(key => numeric(room?.[key]) !== null));
    if (meetingRoomConfigured && numeric(stats.fbMeetingRoomOperatingDays) === null) issues.push("Isi Meeting Room Operating Days / Year sebelum menghitung revenue meeting room.");
    const ballroomConfigured = ["fbBallroomCapacity","fbBallroomCoverPercent"].some(key => numeric(stats[key]) !== null);
    if (ballroomConfigured && numeric(stats.fbBallroomEventsPerYear) === null) issues.push("Isi Ballroom Events / Year sebelum menghitung revenue ballroom.");
    const deductions: [string,number][] = ["outInventory","houseUse","outOfOrder"].map(k => [k,numeric(stats[k]) ?? 0] as [string,number]);
    for (const [key,value] of deductions) if (!Number.isFinite(value) || value < 0) issues.push("Statistik "+key+" tidak boleh negatif atau tidak valid.");
    if (deductions.reduce((s,x)=>s+x[1],0)>totalRoomBuild) issues.push("Out of Inventory + House Use + Out of Order melebihi Total Room Build.");
    const roomAvailable=totalRoomBuild-deductions.reduce((s,x)=>s+x[1],0);
    const comp=numeric(stats.complimentary)??0, paid=numeric(stats.roomPaid)??0;
    if (comp<0||paid<0) issues.push("Complimentary dan Room Paid tidak boleh negatif.");
    if (comp+paid>roomAvailable) issues.push("Complimentary + Room Paid melebihi Room Available. Periksa room nights dan statistik inventori.");
    if (!form.confirmAccountReview) warnings.push("Konfirmasi tinjauan akun belum dicentang; validasi tetap berfokus pada data budget dan konsistensi hasil akhir.");
    const accounts = form.accounts as Record<string, any>;
    const submittedLines = Array.isArray(form.accountLines) ? form.accountLines : [];
    const submittedCustomLines = Array.isArray(form.customAccounts) ? form.customAccounts : [];
    const accountLines = [...ACCOUNT_LINES, ...submittedLines.filter((line:any)=>line?.code && !ACCOUNT_LINES.some(item=>item.code===line.code)), ...submittedCustomLines]
      .filter((line:any,index:number,arr:any[])=>arr.findIndex(item=>item?.code===line?.code)===index);
    for (const line of accountLines) {
      const row=accounts[line.code] || {};
      // Validasi final tidak memeriksa kolom Actual/YTD Actual karena data aktual tidak disiapkan pada alur uji ini.
      // Budget, Last Year, YTD Budget, dan Last Year YTD tetap divalidasi.
      for (const column of ["budget","lastYear","ytdBudget","lastYearYtd"] as const) {
        const raw=row[column];
        if (raw===undefined||raw===null||raw==="") continue;
        const value=numeric(raw);
        if (value===null) issues.push(line.code+" "+line.label+": nilai "+column+" bukan angka yang valid.");
        else if (value<0 && !line.allowNegative) issues.push(line.code+" "+line.label+": nilai "+column+" tidak boleh negatif.");
      }
    }
    const calculations=calculateBudget({...form, accountLines});
    if (calculations.roomAvailable!==null && calculations.roomAvailable<0) issues.push("Room Available hasil perhitungan bernilai negatif.");
    if (calculations.occupancy!==null && (calculations.occupancy<0 || calculations.occupancy>100)) issues.push("Occupancy harus berada antara 0% dan 100%.");
    // Pemeriksaan kelengkapan revenue/biaya Actual sengaja dilewati: kolom Actual tidak disiapkan pada tahap uji ini.
    if (!Array.isArray(form.forecast?.monthly) || form.forecast.monthly.length!==12) issues.push("Forecast bulanan harus memuat tepat 12 bulan.");
    if (!Array.isArray(form.forecast?.annual) || form.forecast.annual.length!==10) issues.push("Forecast multi-tahun harus memuat tepat 10 tahun.");
    for (const [label,rows,keys] of [
      ["Forecast bulanan",form.forecast?.monthly||[],["occupancy","adr","fbRevenue","phoneRevenue","otherRevenue","operatingCosts"]],
      ["Forecast tahunan",form.forecast?.annual||[],["days","rooms","occupancy","adr","fbRevenue","otherRevenue","operatingCosts"]]
    ] as [string,any[],string[]][]) {
      for (const row of rows) for (const key of keys) {
        if (row[key]!=="" && row[key]!==null && row[key]!==undefined) {
          const value=numeric(row[key]);
          if (value===null || value<0 || (key==="occupancy" && value>100)) issues.push(label+" "+row.label+" — "+key+" tidak valid.");
          if (value!==null && (key==="days" || key==="rooms") && !Number.isInteger(value)) issues.push(label+" "+row.label+" — "+key+" harus bilangan bulat.");
          if (value!==null && key==="days" && (value<1 || value>366)) issues.push(label+" "+row.label+" — days harus 1–366.");
          if (value!==null && key==="rooms" && value<1) issues.push(label+" "+row.label+" — rooms harus lebih dari nol.");
        }
      }
    }
    // Validate Master Payroll inputs before the payroll calculator treats optional benefits as zero.
    for (const [index, employee] of (Array.isArray(form.payrollEmployees) ? form.payrollEmployees : []).entries()) {
      if (numeric(employee?.headcount) === null || !Number.isInteger(numeric(employee?.headcount)) || (numeric(employee?.headcount) ?? -1) < 0) issues.push("Master Payroll baris " + (index + 1) + " — headcount harus bilangan bulat nol atau lebih.");
      if (numeric(employee?.basicSalary) === null || (numeric(employee?.basicSalary) ?? -1) < 0) issues.push("Master Payroll baris " + (index + 1) + " — gaji pokok wajib diisi dan tidak boleh negatif.");
      for (const key of ["medical","meal","ptkpAnnual","insuranceMonthly","otherMonthly"]) {
        const raw = employee?.[key];
        if (raw === "" || raw === null || raw === undefined) continue;
        const value = numeric(raw);
        if (value === null || value < 0) issues.push("Master Payroll baris " + (index + 1) + " — " + key + " harus angka valid dan tidak negatif.");
      }
    }
    // Validate forecast inputs used by P&L formulas, not only headline fields.
    const extraMonthlyKeys = [
      "phoneRevenue","fbCostOfSales","phoneCostOfSales","modCostOfSales",
      "roomPayroll","fbPayroll","phonePayroll","modPayroll",
      "roomOtherExpenses","fbOtherExpenses","phoneOtherExpenses","modOtherExpenses",
      "agPayroll","smPayroll","hrdPayroll","pomecPayroll",
      "agOtherExpenses","smOtherExpenses","hrdOtherExpenses","pomecOtherExpenses","energyCost",
      "basicManagementFee","otherManagementFee","insuranceGeneral","landLease",
      "ownerInsurance","maintenanceFee","operatorSharePercent","ownerOtherExpenses"
    ];
    for (const row of form.forecast?.monthly || []) {
      for (const key of extraMonthlyKeys) {
        const raw = row?.[key];
        if (raw === "" || raw === null || raw === undefined) continue;
        const value = numeric(raw);
        if (value === null) issues.push("Forecast bulanan "+row.label+" — "+key+" harus berupa angka valid.");
        else if (key === "operatorSharePercent" ? (value < 0 || value > 100) : value < 0) {
          issues.push(key === "operatorSharePercent"
            ? "Forecast bulanan "+row.label+" — operator share harus 0–100%."
            : "Forecast bulanan "+row.label+" — "+key+" tidak boleh negatif.");
        }
      }
      for (const detailKey of ["roomDivisionDetails","fbDetails","modDetails","agDetails","smDetails","hrdDetails","pomecDetails"]) {
        const details = row?.[detailKey];
        if (!details || typeof details !== "object" || Array.isArray(details)) continue;
        for (const [key, raw] of Object.entries(details as Record<string, unknown>)) {
          if (raw === "" || raw === null || raw === undefined) continue;
          const value = numeric(raw);
          if (value === null) issues.push("Forecast bulanan "+row.label+" — detail "+key+" harus berupa angka valid.");
          else if (value < 0 && !/discount|allowance/i.test(key)) {
            issues.push("Forecast bulanan "+row.label+" — detail "+key+" tidak boleh negatif.");
          }
        }
      }
    }
    const actionStatus = String(form.actionStatus || "Belum dimulai");
    const actionProgress = numeric(form.actionProgress);
    const validActionStatuses = ["Belum dimulai","Sedang berjalan","Selesai","Terhambat"];
    if (!validActionStatuses.includes(actionStatus)) issues.push("Status Management Action Plan tidak valid.");
    if (actionProgress === null || !Number.isInteger(actionProgress) || actionProgress < 0 || actionProgress > 100) issues.push("Progress tindakan harus berupa bilangan bulat 0–100%.");
    if (actionStatus === "Selesai" && actionProgress !== 100) issues.push("Status Selesai hanya boleh dipilih jika progress 100%.");
    if (actionStatus === "Sedang berjalan" && (actionProgress === null || actionProgress <= 0 || actionProgress >= 100)) issues.push("Status Sedang berjalan memerlukan progress 1–99%.");
    if (actionStatus === "Terhambat" && (actionProgress === null || actionProgress >= 100)) issues.push("Status Terhambat memerlukan progress di bawah 100%.");
    if (form.actionDue && !isValidIsoDate(form.actionDue)) issues.push("Deadline harus berupa tanggal kalender yang valid.");
    if (actionStatus !== "Belum dimulai") {
      if (!String(form.actionRecommendation || "").trim()) issues.push("Rekomendasi/tindakan wajib diisi jika status sudah berubah dari Belum dimulai.");
      if (!String(form.actionOwner || "").trim()) issues.push("PIC wajib diisi jika status tindakan sudah berubah.");
      if (!String(form.actionDue || "").trim()) issues.push("Deadline wajib diisi jika status tindakan sudah berubah.");
      if (!String(form.actionTarget || "").trim()) issues.push("Target hasil wajib diisi jika status tindakan sudah berubah.");
    }
    if (issues.length) return NextResponse.json({ passed:false, issues:[...new Set(issues)].slice(0,30), warnings, summary:"Pemeriksaan deterministik gagal. Laporan belum disimpan." }, { status:422 });

    const apiKey=process.env.GEMINI_API_KEY;
    if (!apiKey) return NextResponse.json({ passed:false, issues:["GEMINI_API_KEY tidak tersedia; AI Orchestrator wajib menyelesaikan validasi sebelum penyimpanan."], warnings, error:"Validasi AI belum tersedia. Laporan belum disimpan." }, { status:503 });
    const google=createGoogleGenerativeAI({apiKey});
    const reviewPrompt=`Validasi final laporan hotel CoreStay dengan fokus utama pada rekonsiliasi hasil akhir terhadap data sumber yang benar-benar telah diinput. Jangan mengubah angka atau mengarang nilai. Data kosong harus tetap kosong dan tidak otomatis dianggap nol. Bandingkan input Step 1 Statistics/Revenue, Step 2 akun Budget P&L, Master Payroll, Department Expenses, Owner Expenses, Forecast bulanan, Annual Forecast, 1 Year Consolidated, 10 Years Consolidated, dan hasil export bila tersedia. Gunakan kalkulasi server sebagai sumber kebenaran matematis: ${JSON.stringify(calculations)}. Statistik: ${JSON.stringify(stats)}. Master Payroll: ${JSON.stringify(form.payrollEmployees || [])}. Akun P&L (JSON): ${JSON.stringify(accounts)}. Forecast: ${JSON.stringify(form.forecast)}. Periksa transfer nilai dari sumber ke laporan, subtotal/total budget, revenue budget, cost of sales, payroll, operating expenses, overhead, GOP/margin budget, serta deteksi nilai invalid, duplikasi, salah klasifikasi, NaN/Infinity, atau ketidaksesuaian formula. Pastikan total 12 bulan cocok dengan Annual Forecast dan year-1 pada 10-Year Consolidated, serta pertumbuhan tahun berikutnya mengikuti asumsi yang diinput. LEWATI seluruh pemeriksaan kelengkapan, rekonsiliasi, dan warning yang berkaitan dengan kolom Actual/YTD Actual, termasuk Total Revenue Actual, biaya operasional Actual, dan jumlah baris akun Actual kosong karena data tersebut memang tidak disiapkan. Jangan meminta pengguna mengisi Actual untuk meloloskan laporan. Nilai kosong tetap kosong dan tidak dianggap nol. Baris Master Payroll identik antar departemen bukan alasan untuk menggagalkan validasi kecuali ada bukti nilai dihitung ganda dalam hasil akhir. passed=false hanya untuk kesalahan matematis/data invalid atau ketidaksesuaian material yang didukung bukti input. Ringkasan Bahasa Indonesia singkat dan sebutkan sumber/kelompok yang tidak cocok.`;
    let review: z.infer<typeof ReviewSchema>|null=null;
    let lastError: unknown=null;
    for (const modelId of ["gemini-3.8-flash","gemini-3.5-flash-lite","gemini-2.5-flash","gemini-2.0-flash"]) {
      try {
        const result=await generateObject({
          model:google(modelId), schema:ReviewSchema, maxRetries:0,
          abortSignal:AbortSignal.timeout(12000),
          system:"Anda adalah CORESTAY HOTEL BUDGET ORCHESTRATOR. Reviewer final yang konservatif. Validasi berdasarkan bukti. Jangan menghitung ulang dengan angka berbeda dan jangan pernah mengubah input. Jika ada keraguan material, tolak.",
          prompt:reviewPrompt
        });
        review=result.object;
        break;
      } catch(error) { lastError=error; console.error("Hotel Budget Orchestrator model failed",modelId,error); }
    }
    if (!review) {
      console.error("Hotel Budget Orchestrator unavailable",lastError);
      return NextResponse.json({ passed:false, issues:["AI Orchestrator tidak berhasil menyelesaikan validasi final. Laporan belum disimpan."], warnings, error:"Layanan AI sedang sibuk atau tidak tersedia. Data form tetap ada; coba lagi." }, { status:503 });
    }
    // Safety net: abaikan temuan AI yang hanya mempersoalkan kelengkapan Actual/YTD Actual.
    const actualOnlyFinding = (message:string) => /actual|aktual|ytd\s*actual/i.test(message)
      && /kosong|belum (?:ada|diisi|lengkap|dapat)|tidak (?:ada|tersedia|diisi)|missing|incomplete|kelengkapan|revenue|biaya|cost|akun/i.test(message);
    const allIssues=[...new Set(review.issues.filter((item)=>!actualOnlyFinding(item)))];
    const allWarnings=[...new Set([...warnings,...review.warnings.filter((item)=>!actualOnlyFinding(item))])];
    if (!review.passed || allIssues.length) return NextResponse.json({ passed:false, issues:allIssues.length?allIssues:["AI Orchestrator belum menyetujui laporan."], warnings:allWarnings, summary:review.summary }, { status:422 });
    const validation={passed:true,summary:review.summary,warnings:allWarnings,orchestrator:"CORESTAY HOTEL BUDGET ORCHESTRATOR",deterministicChecks:true,aiReview:true,validatedAt:new Date().toISOString()};
    if (!auth) {
      const report = { id:"local-"+crypto.randomUUID(), hotel_name:hotelName, period_label:period, calculated_data:calculations, validation_data:validation, created_at:new Date().toISOString(), form_data:form, storage:"local" };
      return NextResponse.json({ passed:true, report, warnings:allWarnings, summary:review.summary, orchestrator:validation.orchestrator });
    }
    let saved: any = null, saveError: unknown = null;
    try {
      const r = await sql.query("insert into budget_report(tenant_id,user_id,file_name,report_json) values($1,$2,$3,$4::jsonb) returning id,file_name,report_json,created_at",
        [auth.s.tid, auth.s.uid, (hotelName+" - "+period).slice(0,240), JSON.stringify({ form_data:form, calculated_data:calculations, validation_data:validation })]);
      saved = r[0];
    } catch (e) { saveError = e; }
    if (saveError || !saved) {
      console.error("Hotel budget report save failed",saveError);
      return NextResponse.json({ passed:false, issues:["Validasi lolos, tetapi database menolak penyimpanan. Coba lagi atau hubungi admin."], warnings:allWarnings, error:"Gagal menyimpan laporan. Tidak ditampilkan sebagai tersimpan." }, { status:503 });
    }
    const report = { id:saved.id, hotel_name:hotelName, period_label:period, calculated_data:calculations, validation_data:validation, created_at:saved.created_at, form_data:form, storage:"account" };
    return NextResponse.json({ passed:true, report, warnings:allWarnings, summary:review.summary, orchestrator:validation.orchestrator });
  } catch(error) {
    console.error("Hotel Budget report POST failed",error);
    return NextResponse.json({ passed:false, issues:["Terjadi kesalahan saat memvalidasi atau menyimpan laporan."], error:"Validasi final gagal. Laporan belum disimpan." }, { status:500 });
  }
}
