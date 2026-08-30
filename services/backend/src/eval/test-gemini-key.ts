import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });

async function testGemini() {
  if (!process.env.GEMINI_API_KEY) {
    console.error("No API key configured");
    return;
  }
  console.log("Testing Gemini with key:", process.env.GEMINI_API_KEY.substring(0, 10) + "...");
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const response = await ai.models.generateContent({
      model: 'gemini-3.6-flash',
      contents: 'Hello, are you functional?',
    });
    console.log("Success! Response:", response.text);
  } catch (error: any) {
    console.error("Gemini call failed:", error.message || error);
  }
}

testGemini();
