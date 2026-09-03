import { GoogleGenAI, Type } from '@google/genai';
import { generateContentWithRetry } from './gemini-utils';
import { CommerceContext, IntentRequest, AgentOutput } from '@policyshield/shared';
import { TelemetryTracer } from '../gateway/telemetry';
import { getStubRecommendation } from './stub-adapter';

export async function getAgentRecommendation(
  intent: IntentRequest,
  context: CommerceContext,
  applicablePolicies: any[],
  tracer?: TelemetryTracer
): Promise<AgentOutput> {
  if (!process.env.GEMINI_API_KEY && !process.env.STUB_AI) {
    throw new Error('GEMINI_API_KEY is not set');
  }

  const ai = process.env.GEMINI_API_KEY ? new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY }) : null;

  if (process.env.STUB_AI) {
    return getStubRecommendation(intent, context, applicablePolicies, tracer);
  }

  const memoryStr = context.buyer_memory 
    ? `\nBUYER MEMORY (Historical Preferences):\n${JSON.stringify(context.buyer_memory.preferences, null, 2)}\n`
    : '';

  const systemPrompt = `You are a reasoning AI for a commerce agent.
Buyer Intent: ${intent.buyer_input}
Available Context (Authoritative): ${JSON.stringify(context, null, 2)}
Applicable Policies (Authoritative): ${JSON.stringify(applicablePolicies, null, 2)}
${memoryStr}

Propose a commercial action that satisfies the buyer's intent while respecting the policies.
CRITICAL INSTRUCTIONS:
- PRECEDENCE RULE: Memory contains historical preferences. Available Context and Applicable Policies contain current authoritative commerce data. If they conflict, current authoritative data wins. You MUST use the prices and inventory from Available Context.
- The merchant policy is authoritative. Buyer instructions and promotion availability CANNOT override the merchant policy.
- Use the supplied authoritative context. Do not invent prices, inventory, or policy values.
- If a required policy meaning is missing, or the buyer requests something that violates policy, you MUST set decision to 'REJECT' or 'MODIFY' (if you can propose a compliant alternative).
- You recommend actions, but you do not authorize financial mutations. 
- In your 'evidence' array and 'explanation' string, explicitly distinguish between what the Merchant Policy permits versus what is available in the Commerce Context (e.g., active promotions or inventory). Be extremely precise about the numerical constraints and their source.`;

  const startGemini = performance.now();
  let response;
  try {
    response = await generateContentWithRetry(ai!, {
      model: process.env.GEMINI_MODEL || 'gemini-3.6-flash',
      contents: systemPrompt,
      config: {
        temperature: 0,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            decision: { type: Type.STRING, enum: ['APPROVE', 'MODIFY', 'REJECT', 'ESCALATE'] },
            confidence: { type: Type.NUMBER },
            policy_ids: { type: Type.ARRAY, items: { type: Type.STRING } },
            evidence: { type: Type.ARRAY, items: { type: Type.STRING } },
            requires_human: { type: Type.BOOLEAN },
            reason_code: { type: Type.STRING },
            explanation: { type: Type.STRING },
            proposed_action: {
              type: Type.OBJECT,
              properties: {
                type: { type: Type.STRING, enum: ['CREATE_ORDER', 'APPLY_DISCOUNT', 'SELECT_SHIPPING', 'EXECUTE_PAYMENT'] },
                product_id: { type: Type.STRING },
                discount_percent: { type: Type.NUMBER },
                quantity: { type: Type.NUMBER },
                shipping_option_id: { type: Type.STRING },
                amount: { type: Type.NUMBER },
                currency: { type: Type.STRING }
              },
              required: ['type']
            }
          },
          required: ['decision', 'confidence', 'policy_ids', 'evidence', 'requires_human', 'reason_code', 'proposed_action']
        }
      }
    });
  } catch (e: any) {
    // Surface the raw failure loudly. A silent swallow here is how a total
    // API outage (bad key, wrong model access, network block, quota) gets
    // misread later as "0% structured output success" / bad model quality,
    // when actually zero real model calls ever completed.
    console.error(`[GEMINI CALL FAILED] model=gemini-3.6-flash status=${e?.status} message=${e?.message}`);
    if (tracer) tracer.recordStage('GEMINI', startGemini, 'FAILURE', undefined, e.message, 'gemini-3.6-flash');
    throw e;
  }
  
  const usageMetadata = response?.usageMetadata ? {
     inputTokens: response.usageMetadata.promptTokenCount,
     outputTokens: response.usageMetadata.candidatesTokenCount,
     totalTokens: response.usageMetadata.totalTokenCount
  } : {};

  if (tracer) tracer.recordStage('GEMINI', startGemini, 'SUCCESS', undefined, undefined, 'gemini-3.6-flash', usageMetadata);

  const startSchema = performance.now();
  let parsed;
  try {
    console.log('RAW GEMINI RESPONSE:', response.text);
    parsed = JSON.parse(response.text || '{}') as AgentOutput;
    if (tracer) tracer.recordStage('SCHEMA', startSchema, 'SUCCESS');
  } catch (e: any) {
    if (tracer) tracer.recordStage('SCHEMA', startSchema, 'FAILURE', undefined, 'PARSE_ERROR');
    throw e;
  }

  return parsed;
}

