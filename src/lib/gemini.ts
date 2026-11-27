import 'server-only';
import { GoogleGenerativeAI, type GenerationConfig } from '@google/generative-ai';

/** Primary model; override with GEMINI_MODEL. Falls back to GEMINI_FALLBACK_MODEL on any error. */
export const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-3.5-flash';
/**
 * Cheap, fast model for short summaries (tier: 'light'); override with GEMINI_LIGHT_MODEL.
 * Measured on a review summary: gemini-3.5-flash spent ~740 thinking tokens and 6.6s,
 * gemini-3.5-flash-lite with minimal thinking 0 thinking tokens and 0.8s.
 */
export const GEMINI_LIGHT_MODEL = process.env.GEMINI_LIGHT_MODEL || 'gemini-3.5-flash-lite';
// gemini-2.5-flash is deprecated (Google routes it to 3.5 Flash-Lite from 2026-12-01)
export const GEMINI_FALLBACK_MODEL = process.env.GEMINI_FALLBACK_MODEL || 'gemini-3.5-flash-lite';

function getApiKey(): string | null {
  const key = process.env.GEMINI_API_KEY;
  return key && key !== 'your_gemini_api_key' ? key : null;
}

export function hasGemini(): boolean {
  return getApiKey() !== null;
}

interface GenerateOptions {
  json?: boolean;
  systemInstruction?: string;
  /** 'light': the cheap model with thinking (near) off, for short summaries that need no reasoning */
  tier?: 'default' | 'light';
  /** Upper bound on output tokens (thinking tokens count toward it), to cap the cost of one call */
  maxOutputTokens?: number;
}

/**
 * Thinking switched (near) off for Flash models: Gemini 3+ take a level, 2.5 a token budget.
 * Other models (e.g. Pro, which can't go this low) keep their default thinking.
 */
function minimalThinking(model: string): Record<string, unknown> | null {
  if (/^gemini-2\.5-flash/.test(model)) return { thinkingBudget: 0 };
  if (/^gemini-(?:[3-9]|\d{2,})[\d.]*-flash/.test(model)) return { thinkingLevel: 'minimal' };
  return null;
}

/** Generates text with the primary model, retrying once on the fallback model. Returns null when unavailable. */
export async function generateText(prompt: string, options: GenerateOptions = {}): Promise<string | null> {
  const key = getApiKey();
  if (!key) return null;
  const genAI = new GoogleGenerativeAI(key);
  const light = options.tier === 'light';
  const primary = light ? GEMINI_LIGHT_MODEL : GEMINI_MODEL;
  const models = GEMINI_FALLBACK_MODEL && GEMINI_FALLBACK_MODEL !== primary
    ? [primary, GEMINI_FALLBACK_MODEL]
    : [primary];

  let lastError: unknown = null;
  for (const name of models) {
    try {
      const thinking = light ? minimalThinking(name) : null;
      const config: Record<string, unknown> = {
        ...(options.json ? { responseMimeType: 'application/json' } : {}),
        ...(options.maxOutputTokens ? { maxOutputTokens: options.maxOutputTokens } : {}),
        // thinkingConfig is passed through as-is; this SDK version's types don't list it yet
        ...(thinking ? { thinkingConfig: thinking } : {}),
      };
      const model = genAI.getGenerativeModel({
        model: name,
        ...(options.systemInstruction ? { systemInstruction: options.systemInstruction } : {}),
        ...(Object.keys(config).length > 0 ? { generationConfig: config as GenerationConfig } : {}),
      });
      const result = await model.generateContent(prompt);
      return result.response.text();
    } catch (err) {
      lastError = err;
      console.warn(`[gemini] ${name} failed, ${name === models[models.length - 1] ? 'giving up' : 'trying fallback'}`);
    }
  }
  console.error('[gemini] all models failed:', lastError);
  return null;
}

/** Like generateText with JSON mode; returns null when the model is unavailable or the JSON is invalid. */
export async function generateJson<T>(prompt: string, options: Omit<GenerateOptions, 'json'> = {}): Promise<T | null> {
  const text = await generateText(prompt, { ...options, json: true });
  if (!text) return null;
  try {
    return JSON.parse(text) as T;
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]) as T;
    } catch {
      return null;
    }
  }
}
