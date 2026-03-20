import { NextResponse } from "next/server";
import { syncRagStore } from "@/lib/rag-sync";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const apiKey = process.env.GOOGLE_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "GOOGLE_API_KEY not configured" },
        { status: 500 }
      );
    }

    const result = await syncRagStore(apiKey);

    return NextResponse.json({
      success: true,
      chunksCreated: result.chunksCreated,
      errors: result.errors,
    });
  } catch (err) {
    console.error("[rag/sync] Error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Sync failed" },
      { status: 500 }
    );
  }
}
