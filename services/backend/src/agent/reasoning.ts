import { GoogleGenAI, Type } from '@google/genai';
import { CommerceContext, IntentRequest, AgentOutput } from '@policyshield/shared';
import { TelemetryTracer } from '../gateway/telemetry';

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
    const startStub = performance.now();
    const input = intent.buyer_input || '';
    let decision = 'APPROVE';
    let action: any = { type: 'CREATE_ORDER', amount: 1000, currency: 'INR', product_id: 'prod_macbook', quantity: 1 };
    
    const discountMatch = input.match(/(\d+)%\s*discount/i);
    if (discountMatch) {
      action.type = 'APPLY_DISCOUNT';
      action.requested_discount_percent = parseInt(discountMatch[1], 10);
      // Stub AI proposes 15% (maybe saw a promo), unless input tells it to propose something else
      action.discount_percent = input.includes('propose 15') ? 15 : action.requested_discount_percent;
      if (input.includes('Dell XPS')) action.product_id = 'prod_laptop_2';
    }
    
    if (input.toLowerCase().includes('ignore')) {
      decision = 'REJECT';
    } else if (input.includes('60000') || input.includes('20 laptops')) {
      action.amount = 60000;
    }
    
    if (tracer) tracer.recordStage('GEMINI', startStub, 'SUCCESS', undefined, undefined, 'stub-model');
    if (tracer) tracer.recordStage('SCHEMA', performance.now(), 'SUCCESS');
    
    return {
      decision: decision as any,
      confidence: 0.9,
      policy_ids: [],
      evidence: [],
      requires_human: decision === 'ESCALATE',
      reason_code: 'TEST',
      proposed_action: action
    };
  }

  const systemPrompt = `You are a reasoning AI for a commerce agent.
Buyer Intent: ${intent.buyer_input}
Available Context: ${JSON.stringify(context, null, 2)}
Applicable Policies: ${JSON.stringify(applicablePolicies, null, 2)}

Propose a commercial action that satisfies the buyer's intent while respecting the policies. 
CRITICAL: In your 'evidence' array and 'explanation' string, explicitly distinguish between what the Merchant Policy permits versus what is available in the Commerce Context (e.g., active promotions or inventory). Be extremely precise about the numerical constraints and their source.`;

  const startGemini = performance.now();
  let response;
  try {
    response = await ai!.models.generateContent({
      model: 'gemini-3.6-flash',
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
    parsed = JSON.parse(response.text || '{}') as AgentOutput;
    if (tracer) tracer.recordStage('SCHEMA', startSchema, 'SUCCESS');
  } catch (e: any) {
    if (tracer) tracer.recordStage('SCHEMA', startSchema, 'FAILURE', undefined, 'PARSE_ERROR');
    throw e;
  }

  return parsed;
}

