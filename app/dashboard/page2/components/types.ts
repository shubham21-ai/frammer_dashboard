export interface BreakdownItem {
  id: string;
  name: string;
  up: number;
  pr: number;
  pb: number;
  rate: number;
  durationUploaded?: number;
  durationCreated?: number;
  durationPublished?: number;
}

export interface TrendItem {
  month: string;
  uploaded: number;
  processed: number;
  published: number;
}

export interface KPIs {
  totalUploaded: number;
  totalProcessed: number;
  totalPublished: number;
  publishRate: number;
  processRate: number;
  avgDuration: number;
  dropGap: number;
}

export interface Page2Data {
  filters: {
    clients: string[];
  };
  kpis: KPIs;
  breakdowns: {
    channel: BreakdownItem[];
    client: BreakdownItem[];
    user: BreakdownItem[];
    inputType: BreakdownItem[];
    outputType: BreakdownItem[];
    language: BreakdownItem[];
  };
  trend: TrendItem[];
}

export type DimensionKey =
  | "channel"
  | "client"
  | "user"
  | "inputType"
  | "outputType"
  | "language";

export type ChartMode = "stacked" | "grouped";
export type MetricKey = "count" | "published";
export type SortKey = "pub" | "proc" | "rate";
