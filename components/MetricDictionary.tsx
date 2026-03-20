"use client";
import { useState } from "react";

const SECTIONS = [
  {
    title: "Core Pipeline KPIs",
    metrics: [
      { name: "Total Uploaded Volume", formula: "COUNT(videos WHERE uploaded_at IS NOT NULL)", description: "Raw long-form or live content that entered the system. Each row = one source video ingested by Frammer AI.", unit: "count + hours" },
      { name: "Total AI-Generated Output", formula: "COUNT(videos WHERE processed_at IS NOT NULL)", description: "AI-processed outputs produced from uploaded content. Multiple outputs can be generated from one upload.", unit: "count + hours" },
      { name: "Total Published", formula: "COUNT(videos WHERE published_flag = true)", description: "Videos pushed live to a publishing platform (YouTube, Instagram, etc.).", unit: "count + hours" },
      { name: "Publish Rate", formula: "Published ÷ Processed × 100", description: "Percentage of AI-generated content that reaches a publishing platform. Lower = more content waste.", unit: "%" },
      { name: "Process Rate", formula: "Processed ÷ Uploaded × 100", description: "Percentage of uploads that were successfully processed by the AI pipeline.", unit: "%" },
    ]
  },
  {
    title: "Executive KPIs (Page 1)",
    metrics: [
      { name: "Est. Human Hours Saved", formula: "SUM(uploaded_duration_hours) × 3", description: "Estimated manual editing hours eliminated. Assumes 1h raw content = 3h manual editing work.", unit: "hours" },
      { name: "Time-to-Market", formula: "AVG(published_at − uploaded_at)", description: "Average hours from raw upload to published on social. Lower = faster production pipeline.", unit: "hours" },
      { name: "Content Waste Index", formula: "total_created_hours − total_published_hours", description: "Volume of AI-generated content that was never published. Should trend towards zero.", unit: "hours" },
      { name: "Client Concentration Risk", formula: "(top_client_uploaded_hours ÷ total_uploaded_hours) × 100", description: "Revenue/usage dependency on a single client. Above 60% = high concentration risk.", unit: "%" },
      { name: "AI Content Multiplier", formula: "total_created ÷ total_uploaded", description: "For every 1 raw upload, how many AI outputs are produced. Higher = greater AI amplification.", unit: "multiple (e.g. 8×)" },
      { name: "Period-over-Period Growth", formula: "(current_month − prev_month) ÷ prev_month × 100", description: "Month-over-month growth in combined volume (uploaded + published).", unit: "%" },
    ]
  },
  {
    title: "Operational KPIs (Page 4)",
    metrics: [
      { name: "Data Completeness Score", formula: "(videos with input_type + language + platform + url filled) ÷ total × 100", description: "Percentage of videos with complete metadata. Poor completeness reduces reporting accuracy.", unit: "%" },
      { name: "Feature Penetration", formula: "AVG(distinct output types per client) ÷ total available output types", description: "How broadly each client uses the available output formats. Low = upsell opportunity.", unit: "ratio" },
      { name: "Publish Efficiency (Hours)", formula: "total_published_hours ÷ total_created_hours × 100", description: "What % of processed content hours are actually published. Measures content utilisation.", unit: "%" },
      { name: "At-Risk Accounts", formula: "COUNT(clients WHERE published < 100)", description: "Clients with very low publishing output — may indicate churn risk or onboarding issues.", unit: "count" },
    ]
  },
  {
    title: "Dimensions",
    metrics: [
      { name: "Client", formula: "client_id", description: "A paying organisation using Frammer AI. One client may have multiple channels.", unit: "dimension" },
      { name: "Channel / Workspace", formula: "channel_id", description: "A workspace within a client. Different channels can have different users, languages, and content types.", unit: "dimension" },
      { name: "Input Type", formula: "input_type_name", description: "Category of the source content (e.g. Speech, Interview, Special Report, Press Conference).", unit: "dimension" },
      { name: "Output Type", formula: "output_type_name", description: "Format of the AI-generated output (e.g. Shorts, Reels, Summary, Chapters, MKM).", unit: "dimension" },
      { name: "Language", formula: "language_name", description: "Language of the source or output content.", unit: "dimension" },
      { name: "Platform", formula: "published_platform", description: "Target publishing destination (e.g. YouTube, Instagram, LinkedIn).", unit: "dimension" },
    ]
  },
  {
    title: "Data Quality Rules",
    metrics: [
      { name: "Missing Platform", formula: "published_flag = true AND published_platform IS NULL", description: "Published videos without a platform record. Indicates incomplete metadata on publish.", unit: "count" },
      { name: "Missing User", formula: "user_id IS NULL OR user_id = ''", description: "Videos with no user attribution. Reduces user-level analysis accuracy.", unit: "count" },
      { name: "Unknown Input Type", formula: "input_type_name IS NULL OR input_type_name = 'Unknown'", description: "Videos without a recognised input category. Reduces content-type analysis.", unit: "count" },
      { name: "Month Assignment Rule", formula: "COALESCE(uploaded_at, published_at, processed_at)", description: "Videos are assigned to a month using the first available date. Ensures all videos appear in monthly summaries.", unit: "logic" },
    ]
  }
];

interface MetricDictionaryProps {
  open: boolean;
  onClose: () => void;
}

export default function MetricDictionary({ open, onClose }: MetricDictionaryProps) {
  const [search, setSearch] = useState("");

  if (!open) return null;

  const filtered = search.trim()
    ? SECTIONS.map(s => ({
        ...s,
        metrics: s.metrics.filter(m =>
          m.name.toLowerCase().includes(search.toLowerCase()) ||
          m.description.toLowerCase().includes(search.toLowerCase())
        )
      })).filter(s => s.metrics.length > 0)
    : SECTIONS;

  return (
    <div className="fixed inset-0 z-[200] flex items-start justify-center bg-black/40 backdrop-blur-sm p-4 overflow-y-auto" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl my-4">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 sticky top-0 bg-white rounded-t-2xl z-10">
          <div>
            <h2 className="text-base font-bold text-gray-900">Metric Dictionary</h2>
            <p className="text-xs text-gray-400 mt-0.5">All KPI definitions, formulas, dimensions, and data quality rules</p>
          </div>
          <div className="flex items-center gap-2">
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search metrics..."
              className="text-xs border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:border-red-300 w-48"
            />
            <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-lg leading-none px-2">✕</button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {filtered.map(section => (
            <div key={section.title}>
              <h3 className="text-xs font-bold uppercase tracking-wider text-red-500 mb-3 border-b border-red-100 pb-1">{section.title}</h3>
              <div className="space-y-1">
                {section.metrics.map(m => (
                  <div key={m.name} className="grid grid-cols-[200px_1fr_140px] gap-4 py-2.5 px-3 rounded-lg hover:bg-gray-50 transition-colors">
                    <div>
                      <p className="text-xs font-semibold text-gray-800">{m.name}</p>
                      <p className="text-[9px] font-mono text-gray-400 mt-0.5">{m.unit}</p>
                    </div>
                    <p className="text-xs text-gray-600">{m.description}</p>
                    <code className="text-[9px] text-blue-600 bg-blue-50 rounded px-2 py-1 font-mono leading-relaxed self-start">{m.formula}</code>
                  </div>
                ))}
              </div>
            </div>
          ))}
          {filtered.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-8">No metrics match &ldquo;{search}&rdquo;</p>
          )}
        </div>
      </div>
    </div>
  );
}
