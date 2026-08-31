import 'dotenv/config';
import { GoogleGenAI, Type } from '@google/genai';

async function test() {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3.6-flash',
      contents: 'Say hello',
      config: {
        temperature: 0,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            message: { type: Type.STRING }
          }
        }
      }
    });
    console.log('SUCCESS:', response.text);
  } catch (e: any) {
    console.error('ERROR:', e.message, e.status);
  }
}
test();
