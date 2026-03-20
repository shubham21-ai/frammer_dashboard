export type DashboardKpiId = "kpi_total_uploaded";

export const DASHBOARD_KPI_DEFINITIONS: Record<
  DashboardKpiId,
  {
    title: string;
    definition: string;
    aliases: string[];
  }
> = {
  kpi_total_uploaded: {
    title: "Total Uploaded Volume",
    definition:
      "Raw amount of long-form and live content entering the system. Count and uploaded hours summed across all clients for each month from `monthly_processing_summary` (counts) and `monthly_duration_summary` (uploaded duration).",
    aliases: [
      "total uploaded volume",
      "total uploaded",
      "uploaded volume",
      "total uploads",
      "kpi total uploaded",
    ],
  },
};

export function matchDashboardKpiId(question: string): DashboardKpiId | null {
  const q = question.toLowerCase();
  for (const [id, def] of Object.entries(DASHBOARD_KPI_DEFINITIONS) as Array<
    [DashboardKpiId, (typeof DASHBOARD_KPI_DEFINITIONS)[DashboardKpiId]]
  >) {
    if (def.aliases.some((a) => q.includes(a))) return id;
  }
  return null;
}

