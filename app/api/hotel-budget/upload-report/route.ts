import { budgetSession } from "@/lib/budget/guard";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
const MAX_PDF_BYTES = 25 * 1024 * 1024;

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as HandleUploadBody;
    const response = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        if (!(await budgetSession())) throw new Error("Silakan login kembali atau minta akses Hotel Budget.");
        if (!pathname.startsWith("hotel-budget-email-reports/")) {
          throw new Error("Lokasi unggah tidak diizinkan.");
        }
        let metadata: { fileName?: string } = {};
        try {
          metadata = clientPayload ? JSON.parse(clientPayload) : {};
        } catch {
          throw new Error("Metadata file tidak valid.");
        }
        if (metadata.fileName && !metadata.fileName.toLowerCase().endsWith(".pdf")) {
          throw new Error("Hanya file PDF yang dapat diunggah.");
        }
        return {
          allowedContentTypes: ["application/pdf"],
          maximumSizeInBytes: MAX_PDF_BYTES,
          addRandomSuffix: true,
          tokenPayload: JSON.stringify({ purpose: "hotel-budget-email" })
        };
      },
      onUploadCompleted: async ({ blob, tokenPayload }) => {
        if (!blob.pathname.startsWith("hotel-budget-email-reports/")) {
          throw new Error("Validasi unggahan tidak berhasil.");
        }
      }
    });
    return NextResponse.json(response);
  } catch (error) {
    console.error("CoreStay report upload failed:", error);
    const message = error instanceof Error ? error.message : "Gagal mengunggah PDF.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
