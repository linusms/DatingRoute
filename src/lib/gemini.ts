import 'server-only';
import { GoogleGenerativeAI } from '@google/generative-ai';

/** Primary model; override with GEMINI_MODEL. Falls back to GEMINI_FALLBACK_MODEL on any error. */
export const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-3.5-flash';
export const GEMINI_FALLBACK_MODEL = process.env.GEMINI_FALLBACK_MODEL || 'gemini-2.5-flash';

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
}

/** Generates text with the primary model, retrying once on the fallback model. Returns null when unavailable. */
export async function generateText(prompt: string, options: GenerateOptions = {}): Promise<string | null> {
  const key = getApiKey();
  if (!key) return null;
  const genAI = new GoogleGenerativeAI(key);
  const models = GEMINI_FALLBACK_MODEL && GEMINI_FALLBACK_MODEL !== GEMINI_MODEL
    ? [GEMINI_MODEL, GEMINI_FALLBACK_MODEL]
    : [GEMINI_MODEL];

  let lastError: unknown = null;
  for (const name of models) {
    try {
      const model = genAI.getGenerativeModel({
        model: name,
        ...(options.systemInstruction ? { systemInstruction: options.systemInstruction } : {}),
        ...(options.json ? { generationConfig: { responseMimeType: 'application/json' } } : {}),
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
