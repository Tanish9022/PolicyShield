import dotenv from 'dotenv';
dotenv.config();

import { GoogleGenAI } from '@google/genai';

async function main() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error('No GEMINI_API_KEY found in .env');
    return;
  }
  const ai = new GoogleGenAI({ apiKey });
  const candidates = ['gemini-2.5-flash', 'gemini-1.5-flash', 'gemini-2.0-flash', 'gemini-2.5-pro', 'gemini-1.5-pro'];

  for (const model of candidates) {
    try {
      console.log(`Testing model: ${model}...`);
      const res = await ai.models.generateContent({
        model,
        contents: 'Say hello in two words.'
      });
      console.log(`✅ SUCCESS with ${model}: "${res.text?.trim()}"`);
    } catch (e: any) {
      console.log(`❌ FAILED with ${model}: ${e.status || ''} ${e.message}`);
    }
  }
}

main().catch(console.error);
