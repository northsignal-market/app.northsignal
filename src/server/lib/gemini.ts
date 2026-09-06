import { GoogleGenAI } from '@google/genai';

const geminiKey = process.env.GEMINI_API_KEY;
export const ai = geminiKey ? new GoogleGenAI({ apiKey: geminiKey }) : null;
