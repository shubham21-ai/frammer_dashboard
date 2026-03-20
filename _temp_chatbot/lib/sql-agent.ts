/**
 * SQL Analytics Agent - LangChain + Gemini with system prompt and memory
 */

import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { HumanMessage, AIMessage, SystemMessage } from "@langchain/core/messages";
import type { BaseMessage } from "@langchain/core/messages";
import { query } from "@/lib/db";

const FORBIDDEN = /\b(DROP|DELETE|UPDATE|INSERT|TRUNCATE|ALTER|CREATE|GRANT|REVOKE)\b/i;

/** System prompt - defines agent identity once, not repeated per request */
const SYSTEM_PROMPT = `
You are an SQL analytics assistant for a PostgreSQL analytics database.

Your job is to convert DATA QUESTIONS about this analytics database into SQL queries.

You ONLY handle database/analytics questions. Assume that questions routed to you are
actually about the analytics data or the database itself.

Behavior:
- For questions about what the database contains, what tables exist, or what data is available
  (e.g. "what is this about", "what is the database about", "what data do you have", "what tables are there"):
  -> Generate a valid PostgreSQL SELECT query that introspects \`information_schema\`
     to describe the available tables/columns in the public schema.

- For analytics questions about videos, channels, publishing, performance, or metrics:
  -> Generate a valid PostgreSQL SELECT query using the provided schema tables.

General SQL rules:

1. Only use tables and columns from the provided schema for analytics queries.
   For database-introspection questions, you may also use information_schema.*

2. Never generate: DROP, DELETE, UPDATE, INSERT, ALTER, TRUNCATE, CREATE, GRANT, REVOKE.

3. Limit results to 100 rows unless asked otherwise.

4. Return ONLY the SQL query. No markdown or explanation.
`;

/** System prompt for answering non-database questions purely from chat history */
const HISTORY_PROMPT = `
You are a helpful assistant that can ONLY use the existing chat history for context.

Rules:
- Answer the user's question using ONLY the information contained in the previous messages.
- Do NOT invent or assume new analytics data or database details that were not mentioned before.
- If the user asks about something that is not present in the chat history, clearly say you don't know based on the current conversation and suggest they ask a concrete analytics question instead.
`;

/** LangChain-style in-memory chat history per session */
type SessionHistory = {
  getMessages: () => Promise<BaseMessage[]>;
  addUserMessage: (content: string) => Promise<void>;
  addAIMessage: (content: string) => Promise<void>;
  clear: () => Promise<void>;
};

const sessionStore = new Map<string, SessionHistory>();

function getOrCreateHistory(sessionId: string): SessionHistory {
  let history = sessionStore.get(sessionId);
  if (!history) {
    const messages: BaseMessage[] = [];
    history = {
      getMessages: async () => [...messages],
      addUserMessage: async (content) => {
        messages.push(new HumanMessage(content));
      },
      addAIMessage: async (content) => {
        messages.push(new AIMessage(content));
      },
      clear: async () => {
        messages.length = 0;
      },
    };
    sessionStore.set(sessionId, history);
  }
  return history;
}

function formatSchemaForPrompt(schema: Record<string, { column: string; type: string }[]>): string {
  const lines: string[] = [];
  for (const [table, cols] of Object.entries(schema)) {
    lines.push(`${table} (${cols.map((c) => `${c.column} ${c.type}`).join(", ")})`);
  }
  return lines.join("\n");
}

export async function chatWithSQL(
  question: string,
  schema: Record<string, { column: string; type: string }[]>,
  sessionId: string,
  apiKey: string,
  helpers: {
    inferChartType: (cols: string[], rows: Record<string, unknown>[], first: string) => "line" | "bar" | "pie" | "funnel" | "table";
    buildChartSpec: (cols: string[], rows: Record<string, unknown>[], ct: "line" | "bar" | "pie" | "funnel" | "table") => Record<string, unknown>;
    generateInsights: (q: string, sql: string, rows: Record<string, unknown>[], key: string) => Promise<string[]>;
  },
  ragContext?: string
): Promise<{
  sql: string;
  rows: Record<string, unknown>[];
  table_data: Record<string, unknown>[];
  chart_spec: Record<string, unknown>;
  insights: string[];
  error?: string;
}> {
  const model = new ChatGoogleGenerativeAI({
    model: "gemini-3-flash-preview",
    apiKey,
  });

  const history = getOrCreateHistory(sessionId);
  const schemaText = formatSchemaForPrompt(schema);

  // Build messages: system + history + current question with schema (and optional RAG context)
  const historyMessages = await history.getMessages();
  const ragBlock = ragContext
    ? `\n\nRelevant dashboard context (use to inform your answer; data may be approximate):\n${ragContext}\n`
    : "";
  const userContent = `Schema (you MUST use these tables):
${schemaText}
${ragBlock}
Question: ${question}`;

  const messages = [
    new SystemMessage(SYSTEM_PROMPT),
    ...historyMessages,
    new HumanMessage(userContent),
  ];
  const response = await model.invoke(messages);
  let sql = (response.content as string).trim();
  sql = sql.replace(/^```sql?\s*/i, "").replace(/\s*```$/i, "").trim();

  // Add to LangChain memory for follow-up context
  await history.addUserMessage(userContent);
  await history.addAIMessage(sql);

  if (FORBIDDEN.test(sql)) {
    return {
      sql,
      rows: [],
      table_data: [],
      chart_spec: { type: "table" },
      insights: [],
      error: "Only SELECT queries are allowed.",
    };
  }

  const tables = Object.keys(schema);
  const usedTables = tables.filter((t) => new RegExp(`\\b${t}\\b`, "i").test(sql));
  // Allow pure information_schema introspection queries to pass even if they don't reference
  // any of the user-facing analytics tables.
  if (!/information_schema/i.test(sql) && usedTables.length === 0) {
    return {
      sql,
      rows: [],
      table_data: [],
      chart_spec: { type: "table" },
      insights: [],
      error:
        "Data not available in database. Your question must be about the analytics data (videos, channels, publishing, etc.).",
    };
  }

  try {
    const { rows } = await query<Record<string, unknown>>(sql);
    const table_data = rows.map((r) => ({ ...r }));
    const columns = rows.length > 0 ? Object.keys(rows[0]) : [];
    const chartType = helpers.inferChartType(columns, rows, columns[0] || "");
    const chart_spec = helpers.buildChartSpec(columns, rows, chartType);
    const insights =
      rows.length > 0 ? await helpers.generateInsights(question, sql, rows, apiKey) : [];

    return { sql, rows, table_data, chart_spec, insights };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      sql,
      rows: [],
      table_data: [],
      chart_spec: { type: "table" },
      insights: [],
      error: msg,
    };
  }
}

/** Answer non-database questions using only the existing chat history (no DB access) */
export async function answerFromHistory(
  question: string,
  sessionId: string,
  apiKey: string
): Promise<string> {
  const model = new ChatGoogleGenerativeAI({
    model: "gemini-2.5-flash",
    apiKey,
  });

  const history = getOrCreateHistory(sessionId);
  const historyMessages = await history.getMessages();

  const messages = [
    new SystemMessage(HISTORY_PROMPT),
    ...historyMessages,
    new HumanMessage(question),
  ];

  const response = await model.invoke(messages);
  const content =
    typeof response.content === "string"
      ? response.content.trim()
      : JSON.stringify(response.content);

  await history.addUserMessage(question);
  await history.addAIMessage(content);

  return content;
}

/** Clear memory for a session (e.g. when user starts new chat) */
export function clearSessionMemory(sessionId: string): void {
  sessionStore.delete(sessionId);
}
