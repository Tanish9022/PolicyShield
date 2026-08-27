import { GoogleGenAI, Type } from '@google/genai';
import { PolicyRule, PolicyCompilationResult, PolicyCompilationStatus } from '@policyshield/shared';
import { v4 as uuidv4 } from 'uuid';

export async function compilePolicies(
  naturalLanguageText: string
): Promise<PolicyCompilationResult> {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY is not set');
  }

  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

  // Use Gemini to parse NL into structured policy rules
  const response = await ai.models.generateContent({
    model: 'gemini-3.6-flash',
    contents: `Parse these merchant rules into typed policies:
${naturalLanguageText}`,
    config: {
      temperature: 0.1,
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          status: {
            type: Type.STRING,
            description: 'SUCCESS if all rules are clear, AMBIGUOUS if any rule is undefined or contradictory',
            enum: ['SUCCESS', 'AMBIGUOUS']
          },
          rules: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                policy_id: { type: Type.STRING },
                rule_type: { 
                  type: Type.STRING,
                  enum: ['MAX_DISCOUNT', 'INVENTORY_RESERVE', 'APPROVAL_THRESHOLD', 'SHIPPING_CONSTRAINT', 'CUSTOMER_SEGMENT_OVERRIDE']
                },
                description: { type: Type.STRING },
                conditions: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      field: { type: Type.STRING },
                      operator: { type: Type.STRING, enum: ['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'in', 'not_in'] },
                      value: { type: Type.STRING } // stringified for simplicity
                    }
                  }
                },
                parameters: {
                  type: Type.OBJECT, // Will contain max_discount_percent, reserve_count, etc.
                  properties: {
                    max_discount_percent: { type: Type.NUMBER },
                    reserve_count: { type: Type.NUMBER },
                    threshold_amount: { type: Type.NUMBER },
                    warehouse_id: { type: Type.STRING },
                    customer_segment: { type: Type.STRING }
                  }
                },
                priority: { type: Type.NUMBER }
              }
            }
          },
          issues: {
            type: Type.ARRAY,
            items: { type: Type.STRING }
          }
        },
        required: ['status', 'rules', 'issues']
      }
    }
  });

  const data = JSON.parse(response.text || '{}');
  
  // Return the compiled result. For simplicity, we just pass the JSON through, 
  // relying on Zod in the validator step to catch structural issues.
  return {
    status: data.status as PolicyCompilationStatus,
    issues: data.issues || [],
    graph: data.status === 'SUCCESS' ? {
      merchant_id: '', // Filled in by caller
      version: uuidv4() as any,
      rules: data.rules as PolicyRule[],
      compiled_at: new Date().toISOString(),
      source_text: naturalLanguageText
    } : null
  };
}
