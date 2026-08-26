/**
 * Groq vision food-photo analysis.
 *
 * AI SDK v7 notes (verified against installed typings):
 * - Image content uses the v7 media-part API. The legacy `{ type: "image" }`
 *   part is deprecated in favor of `{ type: "file", mediaType, data }`.
 * - Structured output via `generateObject({ model, schema, messages })`.
 */
import { createGroq } from "@ai-sdk/groq";
import { generateObject, generateText } from "ai";

import {
  foodAnalysisSchema,
  type FoodAnalysis,
} from "@/lib/contracts";

const DEFAULT_VISION_MODEL = "qwen/qwen3.6-27b";

export class AiAnalysisError extends Error {
  constructor(message = "AI_ANALYSIS_FAILED") {
    super(message);
    this.name = "AiAnalysisError";
  }
}

function getModel() {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new AiAnalysisError("AI_ANALYSIS_FAILED: GROQ_API_KEY is not set");
  }
  const groq = createGroq({ apiKey });
  return groq(process.env.GROQ_VISION_MODEL ?? DEFAULT_VISION_MODEL);
}

const NUTRITIONIST_PROMPT = `You are an expert nutritionist analyzing a photo of a meal.
Identify EVERY distinct food or drink item visible in the image.
For each item:
- Estimate a realistic portion size using visual cues such as plate/bowl diameter,
  cutlery length, hand size, glasses/cups, or packaging as scale references.
- Estimate calories in kcal, protein in grams, carbs in grams, and fat in grams for that portion.
Rules:
- NEVER refuse to analyze. If you are unsure about an item or its size, still provide your best
  estimate and mark its confidence as "low".
- Ignore non-food objects (phones, hands, tables, utensils) unless they are edible.
- If the photo contains no food at all, respond with a single item named "No food detected"
  with zeroed macros and confidence "low".
- Keep names concise ("Grilled chicken breast", not "some kind of meat maybe").
Return the result strictly matching the required JSON schema.`;

/** Builds the v7 user message with text + JPEG file parts. */
function buildMessages(base64Jpeg: string) {
  const data = base64Jpeg.startsWith("data:")
    ? base64Jpeg.slice(base64Jpeg.indexOf(",") + 1)
    : base64Jpeg;

  return [
    {
      role: "user" as const,
      content: [
        { type: "text" as const, text: NUTRITIONIST_PROMPT },
        {
          type: "file" as const,
          mediaType: "image/jpeg",
          data,
        },
      ],
    },
  ];
}

async function structuredAttempt(
  base64Jpeg: string,
): Promise<FoodAnalysis> {
  const { object } = await generateObject({
    model: getModel(),
    schema: foodAnalysisSchema,
    schemaName: "FoodAnalysis",
    messages: buildMessages(base64Jpeg),
    temperature: 0.2,
    maxOutputTokens: 2048,
  });
  return object;
}

// v7 note: system role messages are rejected inside `messages` unless
// `allowSystemInMessages` is set; use the dedicated `instructions` option.
const JSON_MODE_INSTRUCTIONS =
  'Respond with ONLY a JSON object of shape {"items":[{"name":string,"portionDescription":string,"calories":number,"proteinG":number,"carbsG":number,"fatG":number,"confidence":"high"|"medium"|"low"}]}. No markdown fences, no commentary.';

/**
 * Fallback for models that reject native json_schema structured outputs:
 * ask for raw JSON in text mode, then validate with zod. Returns the raw
 * model text alongside the (optional) parsed analysis so a repair retry can
 * reuse it.
 */
async function jsonModeAttempt(
  base64Jpeg: string,
): Promise<{ analysis?: FoodAnalysis; rawText: string }> {
  const { text } = await generateText({
    model: getModel(),
    instructions: JSON_MODE_INSTRUCTIONS,
    messages: buildMessages(base64Jpeg),
    temperature: 0.2,
    maxOutputTokens: 2048,
  });

  const parsed = extractAndParseJson(text);
  return parsed.success
    ? { analysis: parsed.data, rawText: text }
    : { rawText: text };
}

/** One-shot repair retry for malformed JSON output. */
async function repairAttempt(rawText: string): Promise<FoodAnalysis> {
  const { text } = await generateText({
    model: getModel(),
    prompt: [
      "The following model output was supposed to be a single JSON object but failed validation.",
      "Fix it so it is ONE valid JSON object with the exact expected shape (no markdown fences, no extra keys, no commentary).",
      'Expected shape: {"items":[{"name":string,"portionDescription":string,"calories":number,"proteinG":number,"carbsG":number,"fatG":number,"confidence":"high"|"medium"|"low"}]}.',
      "Numbers must be plain numbers, not strings.",
      "",
      "Broken output:",
      rawText,
    ].join("\n"),
    temperature: 0,
    maxOutputTokens: 2048,
  });

  const parsed = extractAndParseJson(text);
  if (parsed.success) return parsed.data;
  throw new Error("repair attempt failed to produce valid JSON");
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

function extractAndParseJson(text: string) {
  try {
    return foodAnalysisSchema.safeParse(extractJsonCandidate(text));
  } catch (error) {
    return {
      success: false as const,
      error: error instanceof Error ? error : new Error(String(error)),
    };
  }
}

/**
 * Analyzes a base64-encoded JPEG food photo and returns structured macro
 * estimates. Throws `AiAnalysisError` (message "AI_ANALYSIS_FAILED") when all
 * attempts fail.
 */
export async function analyzeFoodPhoto(
  base64Jpeg: string,
): Promise<FoodAnalysis> {
  try {
    return await structuredAttempt(base64Jpeg);
  } catch {
    // Structured outputs rejected by the model/provider — fall back to
    // JSON-in-text mode with one repair retry. Isolated to this module.
  }

  let rawText: string | null = null;
  try {
    const result = await jsonModeAttempt(base64Jpeg);
    if (result.analysis) return result.analysis;
    rawText = result.rawText;
  } catch {
    // fall through to repair/failure handling below
  }

  if (rawText) {
    try {
      return await repairAttempt(rawText);
    } catch {
      // fall through
    }
  }

  throw new AiAnalysisError();
}
