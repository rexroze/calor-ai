/**
 * Groq vision food-photo analysis.
 *
 * AI SDK v7 notes (verified against installed typings):
 * - Image content uses the v7 media-part API. The legacy `{ type: "image" }`
 *   part is deprecated in favor of `{ type: "file", mediaType, data }`.
 * - System prompt goes in the dedicated top-level `instructions` option;
 *   system-role messages inside `messages` are rejected.
 * - Zod schemas are serialized with `z.toJSONSchema({ io: "input" })`, so the
 *   tolerant (`.catch`/`.default`) schema in lib/contracts.ts is safe to hand
 *   to generateObject AND doubles as runtime validation of stringly output.
 *
 * Attempt budget (hard): primary call with maxRetries 1 (≤2 HTTP attempts) +
 * fallback call with maxRetries 0 (1 HTTP attempt) ⇒ ≤3 HTTP calls worst case,
 * each bounded by a 30s AbortSignal timeout.
 */
import { createGroq } from "@ai-sdk/groq";
import { APICallError, generateObject, generateText } from "ai";

import {
  foodAnalysisSchema,
  type ConfidenceLevel,
  type FoodAnalysis,
  type FoodAnalysisItem,
} from "@/lib/contracts";

const DEFAULT_PRIMARY_MODEL = "qwen/qwen3.8-27b";
const DEFAULT_FALLBACK_MODEL = "qwen/qwen3.6-27b";
const TIMEOUT_MS = 30_000;

export class AiAnalysisError extends Error {
  constructor(message = "AI_ANALYSIS_FAILED") {
    super(message);
    this.name = "AiAnalysisError";
  }
}

function groqModel(modelId: string) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new AiAnalysisError("AI_ANALYSIS_FAILED: GROQ_API_KEY is not set");
  }
  return createGroq({ apiKey })(modelId);
}

const primaryModelId = () =>
  process.env.GROQ_VISION_MODEL ?? DEFAULT_PRIMARY_MODEL;
const fallbackModelId = () =>
  process.env.GROQ_VISION_MODEL_FALLBACK ?? DEFAULT_FALLBACK_MODEL;

/**
 * Dedicated SYSTEM message (passed as the v7 `instructions` option). The
 * first line mentions JSON so Groq's json_object mode accepts the request.
 */
const SYSTEM_PROMPT = [
  "You are an expert nutritionist analyzing meal photos.",
  'Respond with JSON matching the required schema: {"isFood":boolean,"dishName":string,"portionGrams":number,"portionDescription":string,"ingredients":string[],"cookingMethod":string,"calories":number,"proteinG":number,"carbsG":number,"fatG":number,"confidence":number}.',
  "",
  "IDENTIFICATION",
  "- Name the SINGLE most common widely-known dish matching the image.",
  '- Prefer common international names ("grilled pork chop"), never regional or brand names.',
  "- Use visible references (dinner plate ≈27 cm, fork ≈19 cm) to estimate the portion in grams, and state the assumed portion in portionDescription.",
  "- List ONLY ingredients actually visible in the photo.",
  "- State cookingMethod ONLY when visually evident (e.g. char marks → grilled); otherwise use an empty string.",
  "",
  "HONESTY",
  "- If the photo is unclear, shows no food, or could plausibly show several dishes: give your best single common-dish guess and set confidence below 0.5.",
  "- NEVER invent details you cannot see.",
  "- If the image contains no food at all, set isFood to false.",
  "",
  "ESTIMATION",
  "- Derive calories (kcal) and macros (grams) from standard nutrition data for the named dish at the stated portion.",
  "- Round calories and each macro to the nearest 5.",
  "",
  "CONFIDENCE",
  "- confidence is your calibrated certainty in dishName alone, between 0 and 1.",
].join("\n");

/** Builds the v7 user message with text + JPEG file parts. */
function buildMessages(base64Jpeg: string) {
  const data = base64Jpeg.startsWith("data:")
    ? base64Jpeg.slice(base64Jpeg.indexOf(",") + 1)
    : base64Jpeg;

  return [
    {
      role: "user" as const,
      content: [
        { type: "text" as const, text: "Analyze this meal photo." },
        {
          type: "file" as const,
          mediaType: "image/jpeg",
          data,
        },
      ],
    },
  ];
}

/** Maps a 0–1 certainty score onto the consumer-facing confidence label. */
function scoreToConfidenceLabel(score: number): ConfidenceLevel {
  if (score >= 0.66) return "high";
  if (score >= 0.33) return "medium";
  return "low";
}

function roundToNearest5(value: number): number {
  return Math.round(value / 5) * 5;
}

/**
 * Materializes review rows from the single-dish output: consumers read
 * `analysis.items`, so when food was identified we synthesize one item from
 * the dish-level fields; isFood false / no dish ⇒ empty items ("no food
 * detected" handled upstream).
 */
function normalizeAnalysis(analysis: FoodAnalysis): FoodAnalysis {
  if (analysis.items.length > 0 || !analysis.isFood) return analysis;

  const dishName = analysis.dishName.trim();
  if (!dishName) return { ...analysis, items: [] };

  const item: FoodAnalysisItem = {
    name: dishName,
    portionDescription:
      analysis.portionDescription.trim() ||
      (analysis.portionGrams > 0 ? `${analysis.portionGrams} g` : "standard serving"),
    calories: roundToNearest5(analysis.calories),
    proteinG: roundToNearest5(analysis.proteinG),
    carbsG: roundToNearest5(analysis.carbsG),
    fatG: roundToNearest5(analysis.fatG),
    confidence: scoreToConfidenceLabel(analysis.confidence),
  };

  // Guard: if AI identified food but produced zeroed nutrition, reject the
  // analysis — silently saving 0-calorie meals would corrupt the diary.
  if (item.calories === 0 && item.proteinG === 0 && item.carbsG === 0 && item.fatG === 0) {
    throw new Error("AI_ANALYSIS_FAILED");
  }

  return { ...analysis, items: [item] };
}

/** PRIMARY: strict json_schema structured outputs, deterministic latency. */
async function structuredAttempt(base64Jpeg: string): Promise<FoodAnalysis> {
  const { object } = await generateObject({
    model: groqModel(primaryModelId()),
    schema: foodAnalysisSchema,
    schemaName: "FoodAnalysis",
    instructions: SYSTEM_PROMPT,
    messages: buildMessages(base64Jpeg),
    temperature: 0.2,
    maxOutputTokens: 700,
    abortSignal: AbortSignal.timeout(TIMEOUT_MS),
    maxRetries: 1,
    providerOptions: {
      groq: {
        structuredOutputs: true,
        strictJsonSchema: true,
        // Keeps thinking off so latency stays flat instead of variable.
        reasoningEffort: "none",
      },
    },
  });
  return normalizeAnalysis(foodAnalysisSchema.parse(object));
}

/**
 * FALLBACK for models/providers that reject native json_schema structured
 * outputs: JSON-in-text mode, validated with the same tolerant zod schema.
 * The system text mentions JSON (required by Groq's json_object mode).
 */
async function jsonModeAttempt(base64Jpeg: string): Promise<FoodAnalysis> {
  const { text } = await generateText({
    model: groqModel(fallbackModelId()),
    instructions: SYSTEM_PROMPT,
    messages: buildMessages(base64Jpeg),
    temperature: 0.2,
    maxOutputTokens: 700,
    abortSignal: AbortSignal.timeout(TIMEOUT_MS),
    // Fallback IS the chain retry; keeping retries here would blow the ≤3 HTTP budget.
    maxRetries: 0,
    providerOptions: {
      groq: {
        structuredOutputs: false,
        reasoningFormat: "hidden",
        // qwen3.6 is a thinking model; without this its reasoning consumes the
        // whole completion budget and Groq returns an empty generation.
        reasoningEffort: "none",
      },
    },
  });

  const parsed = foodAnalysisSchema.safeParse(extractJsonCandidate(text));
  if (!parsed.success) {
    throw new Error("fallback produced unparseable JSON");
  }
  return normalizeAnalysis(parsed.data);
}

/** Auth/model/config errors must surface immediately — retrying cannot help. */
function isFatalProviderError(error: unknown): boolean {
  return (
    APICallError.isInstance(error) &&
    [401, 404, 422].includes(error.statusCode ?? -1)
  );
}

function extractJsonCandidate(text: string): unknown {
  let cleaned = text.trim();
  cleaned = cleaned.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start !== -1 && end > start) {
    cleaned = cleaned.slice(start, end + 1);
  }
  return JSON.parse(cleaned);
}

/**
 * Analyzes a base64-encoded JPEG food photo and returns structured macro
 * estimates. Throws `AiAnalysisError` (message "AI_ANALYSIS_FAILED") when all
 * attempts fail or on fatal provider errors (401/404/422).
 */
export async function analyzeFoodPhoto(
  base64Jpeg: string,
): Promise<FoodAnalysis> {
  try {
    return await structuredAttempt(base64Jpeg);
  } catch (error) {
    if (isFatalProviderError(error)) {
      console.error(
        "[calorAI] fatal provider error, not falling back:",
        error instanceof Error ? error.message : error,
      );
      throw new AiAnalysisError();
    }
    console.error(
      "[calorAI] structured attempt failed:",
      error instanceof Error ? error.message : error,
    );
  }

  try {
    return await jsonModeAttempt(base64Jpeg);
  } catch (error) {
    console.error(
      "[calorAI] json-mode attempt failed:",
      error instanceof Error ? error.message : error,
    );
  }

  throw new AiAnalysisError();
}
