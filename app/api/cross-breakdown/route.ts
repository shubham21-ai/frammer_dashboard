import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";

// Whitelist: dimension name → SQL column expression (prevents SQL injection)
const DIM_COLS: Record<string, string> = {
  channel:     "v.channel_id",
  client:      "v.client_id",
  user:        "COALESCE(u.user_name, v.user_id)",
  input_type:  "v.input_type_name",
  output_type: "v.output_type_name",
  language:    "v.language_name",
  platform:    "v.published_platform",
};

// Whitelist: metric name → SQL aggregate expression
const METRIC_SQL: Record<string, string> = {
  uploaded_count:  "COUNT(*) FILTER (WHERE v.uploaded_at IS NOT NULL)",
  processed_count: "COUNT(*) FILTER (WHERE v.processed_at IS NOT NULL)",
  published_count: "COUNT(*) FILTER (WHERE v.published_flag = true)",
};

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const dim1Param = sp.get("dim1") ?? "channel";
  const dim2Param = sp.get("dim2") ?? "input_type";
  const metricParam = sp.get("metric") ?? "processed_count";
  const client = sp.get("client") ?? "all";

  // Validate against whitelists — no user-supplied strings reach the SQL
  const dim1Col = DIM_COLS[dim1Param];
  const dim2Col = DIM_COLS[dim2Param];
  const metricSql = METRIC_SQL[metricParam];

  if (!dim1Col || !dim2Col || !metricSql) {
    return NextResponse.json({ error: "Invalid parameters" }, { status: 400 });
  }
  if (dim1Param === dim2Param) {
    return NextResponse.json({ error: "dim1 and dim2 must differ" }, { status: 400 });
  }

  const params: unknown[] = [];
  const conditions: string[] = [];

  if (client !== "all") {
    conditions.push(`v.client_id = $${params.length + 1}`);
    params.push(client);
  }

  const where  = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  // Only JOIN users table when needed (user dimension selected)
  const join   = (dim1Param === "user" || dim2Param === "user")
    ? "LEFT JOIN users u ON u.client_id = v.client_id AND u.user_id = v.user_id"
    : "";

  try {
    const { rows } = await query<{ dim1_val: string; dim2_val: string; value: number }>(
      `SELECT
         COALESCE(NULLIF(TRIM(${dim1Col}::text), ''), 'Unknown') AS dim1_val,
         COALESCE(NULLIF(TRIM(${dim2Col}::text), ''), 'Unknown') AS dim2_val,
         (${metricSql})::int                                      AS value
       FROM videos v
       ${join}
       ${where}
       GROUP BY 1, 2
       HAVING (${metricSql}) > 0
       ORDER BY value DESC`,
      params
    );

    if (rows.length === 0) {
      return NextResponse.json({ chartData: [], dim2Keys: [], totalDim1Distinct: 0, totalDim2Distinct: 0 });
    }

    // Aggregate totals per dim1 / dim2 to find top-N
    const dim1Totals = new Map<string, number>();
    const dim2Totals = new Map<string, number>();
    for (const r of rows) {
      const v = Number(r.value);
      dim1Totals.set(r.dim1_val, (dim1Totals.get(r.dim1_val) ?? 0) + v);
      dim2Totals.set(r.dim2_val, (dim2Totals.get(r.dim2_val) ?? 0) + v);
    }

    const top10Dim1 = new Set(
      [...dim1Totals.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([k]) => k)
    );
    const top6Dim2 = [...dim2Totals.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([k]) => k);
    const top6Dim2Set = new Set(top6Dim2);

    // Pivot rows → { dim1Val, [dim2Key]: value, ... }
    const pivotMap = new Map<string, Record<string, number>>();
    for (const r of rows) {
      if (!top10Dim1.has(r.dim1_val) || !top6Dim2Set.has(r.dim2_val)) continue;
      if (!pivotMap.has(r.dim1_val)) pivotMap.set(r.dim1_val, {});
      pivotMap.get(r.dim1_val)![r.dim2_val] = Number(r.value);
    }

    // Sort chartData by dim1 total (descending)
    const dim1Order = [...top10Dim1].sort(
      (a, b) => (dim1Totals.get(b) ?? 0) - (dim1Totals.get(a) ?? 0)
    );
    const chartData = dim1Order.map((dim1Val) => ({
      dim1Val,
      ...pivotMap.get(dim1Val),
    }));

    return NextResponse.json({
      chartData,
      dim2Keys:           top6Dim2,       // ordered by total desc — consistent legend
      totalDim1Distinct:  dim1Totals.size,
      totalDim2Distinct:  dim2Totals.size,
    });
  } catch (error) {
    console.error("Cross-breakdown error:", error);
    return NextResponse.json(
      { error: "Failed to compute cross-breakdown" },
      { status: 500 }
    );
  }
}
