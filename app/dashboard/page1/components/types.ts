export interface Page1KPIs {
  humanHoursSaved: number;
  humanHoursSavedFormatted: string;
  humanHoursTrendPct: number;
  humanHoursCurrentFormatted?: string;
  humanHoursPrevFormatted?: string;

  timeToMarketHours: number;
  timeToMarketTrendPct: number;
  timeToMarketCurrentHours?: number;
  timeToMarketPrevHours?: number;

  contentWasteFormatted: string;
  contentWasteSeconds: number;
  contentWasteTrendPct: number;
  contentWasteCurrentFormatted?: string;
  contentWastePrevFormatted?: string;

  clientConcentrationPct: number;
  clientConcentrationTrendPct: number;
  clientConcentrationCurrentPct?: number;
  clientConcentrationPrevPct?: number;

  totalUploadedCount: number;
  totalUploadedDurationFormatted: string;
  totalUploadedTrendPct: number;
  currentMonthUploaded?: number;
  currentMonthUploadedDurationFormatted?: string;
  prevMonthUploaded?: number;
  currentMonthCreated?: number;
  prevMonthCreated?: number;

  totalCreated: number;
  totalCreatedDurationFormatted?: string;
  totalCreatedTrendPct: number;
  currentMonthCreatedDurationFormatted?: string;

  aiContentMultiplier: number;
  aiMultiplierTrendPct: number;
  currentMonthMultiplier?: number;
  prevMonthMultiplier?: number;

  periodOverPeriodGrowthPct: number;
  currentMonthCombined?: number;
  prevMonthCombined?: number;

  topPerformingOutputType: string;
  topOutputCurrentMonth?: string;
  topOutputPrevMonth?: string;

  prevMonthLabel?: string;
  currentMonthLabel?: string;

  // Year-over-Year comparison fields
  yoyMonthLabel?: string;
  humanHoursYoYTrendPct?: number;
  humanHoursYoYFormatted?: string;
  timeToMarketYoYTrendPct?: number;
  timeToMarketYoYHours?: number;
  contentWasteYoYTrendPct?: number;
  contentWasteYoYFormatted?: string;
  clientConcentrationYoYTrendPct?: number;
  clientConcentrationYoYPct?: number;
  totalUploadedYoYTrendPct?: number;
  yoyUploaded?: number;
  totalCreatedYoYTrendPct?: number;
  yoyCreated?: number;
  aiMultiplierYoYTrendPct?: number;
  yoyMultiplier?: number;
  yoyTopOutput?: string;
}

export interface LifecycleTrendData {
  byClient: Record<string, { month: string; count: number; duration: number }[]>;
  clients: string[];
}

export interface PipelineStatsData {
  totalUploaded: number;
  totalProcessed: number;
  totalPublished: number;
  monthly: { month: string; uploaded: number; created: number; published: number }[];
}

export interface EfficiencyPoint {
  client_id: string;
  channel_name: string;
  created_count: number;
  published_count: number;
  publish_rate: number;
}

export interface DataHealthAlert {
  video_id: string;
  headline: string;
  published_platform: string;
  user_id: string;
  issue_type: string;
}

export interface TopFormatsRow {
  month: string;
  [outputType: string]: string | number;
}

export interface FeatureMatrix {
  clients: string[];
  outputTypes: string[];
  data: Record<string, Record<string, { created: number; published: number }>>;
}

export interface Page1Alert {
  type: "inactive" | "volume_drop";
  clientId: string;
  message: string;
  severity: "warning" | "critical";
}

export interface Page1Data {
  kpis: Page1KPIs;
  lifecycleTrend: LifecycleTrendData;
  pipelineStats: PipelineStatsData;
  efficiencyMatrix: EfficiencyPoint[];
  topFormatsOverTime: TopFormatsRow[];
  topFormatsOutputTypes: string[];
  featureMatrix: FeatureMatrix;
  dataHealthAlerts: DataHealthAlert[];
  alerts: Page1Alert[];
}
