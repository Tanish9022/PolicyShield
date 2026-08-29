import { GoogleGenAI, Type } from '@google/genai';
import { IntentRequest, ProductCandidate, ProposedAction } from '@policyshield/shared';
import { TelemetryTracer } from '../gateway/telemetry';

/**
 * Negotiate / Propose an action for the selected candidate.
 * If policyFeedback is provided, this acts as the "Adaptation" step.
 */
export async function proposeAction(
  intent: IntentRequest,
  candidate: ProductCandidate,
  policyFeedback?: any,
  tracer?: TelemetryTracer
): Promise<{ proposed_action: ProposedAction, reasoning: string }> {
  const startTotal = performance.now();

  if (!process.env.GEMINI_API_KEY && !process.env.STUB_AI) {
    throw new Error('GEMINI_API_KEY is not set');
  }

  let systemPrompt = `You are an AI Commerce Buyer.
The buyer wants: "${intent.buyer_input}"

You have selected the following product:
${JSON.stringify(candidate, null, 2)}

Your task: Propose a commercial action based on the buyer's intent. 
If they ask for a discount, propose an 'APPLY_DISCOUNT' action with the requested discount_percent.
If they just want to buy it, propose a 'CREATE_ORDER' action.

Constraints:
- Return a structured proposed_action.
- Set 'type' to either 'APPLY_DISCOUNT' or 'CREATE_ORDER'.
- Set 'product_id' to '${candidate.product_id}'.
- If the buyer asks for "maximum discount" or similar, propose an aggressive discount (e.g. 20) in 'discount_percent'. Do not worry about policy here, just advocate for the buyer.
`;

  if (policyFeedback) {
    systemPrompt += `\n\nWARNING: Your previous proposal was REJECTED by the merchant's deterministic policy gate!
Policy Feedback:
${JSON.stringify(policyFeedback, null, 2)}

You must ADAPT your proposal to comply with the merchant's allowed_value or policy constraints. Do not propose the same rejected value again.`;
  }

  let result: { proposed_action: ProposedAction, reasoning: string };

  if (process.env.STUB_AI) {
    // Stub behavior
    let discount = 0;
    if (intent.buyer_input.toLowerCase().includes('maximum discount') || intent.buyer_input.includes('20%')) {
       discount = 20;
    } else if (intent.buyer_input.toLowerCase().includes('for free')) {
       discount = 100;
    }
    if (policyFeedback && policyFeedback.metadata && policyFeedback.metadata.final_discount !== undefined) {
       discount = policyFeedback.metadata.final_discount;
    }

    result = {
      proposed_action: {
        type: discount > 0 ? 'APPLY_DISCOUNT' : 'CREATE_ORDER',
        product_id: candidate.product_id,
        discount_percent: discount,
        amount: candidate.price * (1 - discount / 100),
        base_price: candidate.price
      },
      reasoning: 'Stub negotiation'
    };
  } else {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
    
    try {
      const startGemini = performance.now();
      const response = await ai.models.generateContent({
        model: 'gemini-3.6-flash',
        contents: systemPrompt,
        config: {
          temperature: 0,
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              proposed_action: {
                type: Type.OBJECT,
                properties: {
                  type: { type: Type.STRING, enum: ['APPLY_DISCOUNT', 'CREATE_ORDER'] },
                  product_id: { type: Type.STRING },
                  discount_percent: { type: Type.NUMBER },
                },
                required: ['type', 'product_id']
              },
              reasoning: { type: Type.STRING }
            },
            required: ['proposed_action', 'reasoning']
          }
        }
      });
      
      const usageMetadata = response.usageMetadata ? {
         inputTokens: response.usageMetadata.promptTokenCount,
         outputTokens: response.usageMetadata.candidatesTokenCount,
         totalTokens: response.usageMetadata.totalTokenCount
      } : {};
      
      const stage = policyFeedback ? 'ADAPTATION_GEMINI' : 'NEGOTIATION_GEMINI';
      if (tracer) tracer.recordStage(stage, startGemini, 'SUCCESS', undefined, undefined, 'gemini-3.6-flash', usageMetadata);
      
      const parsed = JSON.parse(response.text || '{}');
      const { ProposedActionSchema } = await import('@policyshield/shared');
      const validatedAction = ProposedActionSchema.parse(parsed.proposed_action);
      
      result = {
        proposed_action: validatedAction as ProposedAction,
        reasoning: parsed.reasoning
      };
    } catch (e: any) {
      const stage = policyFeedback ? 'ADAPTATION_GEMINI' : 'NEGOTIATION_GEMINI';
      if (tracer) tracer.recordStage(stage, startTotal, 'FAILURE', undefined, e.message);
      throw e;
    }
  }

  const stage = policyFeedback ? 'ADAPTATION' : 'NEGOTIATION';
  if (tracer) tracer.recordStage(stage, startTotal, 'SUCCESS', undefined, undefined, undefined, result);

  return result;
}
