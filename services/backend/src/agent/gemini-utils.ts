import { GoogleGenAI } from '@google/genai';

export async function generateContentWithRetry(
  ai: GoogleGenAI,
  params: any,
  maxRetries: number = 3
): Promise<any> {
  let attempt = 0;
  let baseDelay = 1000;
  
  while (attempt <= maxRetries) {
    try {
      return await ai.models.generateContent(params);
    } catch (error: any) {
      const isRetryable =
        error.status === 503 ||
        error.status === 429 ||
        error.code === 'UND_ERR_HEADERS_TIMEOUT' ||
        error.message?.includes('Headers Timeout Error') ||
        error.message?.includes('fetch failed');
        
      if (isRetryable && attempt < maxRetries) {
        attempt++;
        const delay = baseDelay * Math.pow(2, attempt - 1) + Math.random() * 500;
        console.warn(`Gemini API error (attempt ${attempt}/${maxRetries}), retrying in ${Math.round(delay)}ms...`, error.message);
        await new Promise(res => setTimeout(res, delay));
      } else {
        throw error;
      }
    }
  }
}
