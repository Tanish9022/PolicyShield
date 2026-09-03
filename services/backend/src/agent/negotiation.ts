import { GoogleGenAI, Type } from '@google/genai';
import { generateContentWithRetry } from './gemini-utils';
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
    const maxAllowed = policyFeedback.metadata?.final_discount ?? policyFeedback.metadata?.policy_max_discount;
    systemPrompt += `\n\nWARNING: Your previous proposal was REJECTED by the merchant's deterministic policy gate!
Policy Feedback:
${JSON.stringify(policyFeedback, null, 2)}

You must ADAPT your proposal to comply with the merchant's constraints:
- If a discount was rejected for exceeding limits, propose the MAXIMUM allowable discount (specifically ${maxAllowed !== undefined ? maxAllowed : 'the policy ceiling'}%) to maximize value for the buyer while strictly satisfying the policy. Do not propose an arbitrary lower number.
- If no discount is permitted, set 'type' to 'CREATE_ORDER' with discount_percent 0.
- Do not propose the same rejected value again.`;
  }

  let result: { proposed_action: ProposedAction, reasoning: string };

  if (process.env.STUB_AI) {
    // Stub behavior
    let discount = 0;
    const discountMatch = intent.buyer_input.match(/(\d+)%\s*(?:discount|off)?/i);
    if (discountMatch) {
       discount = parseInt(discountMatch[1], 10);
    } else if (intent.buyer_input.toLowerCase().includes('maximum discount') || intent.buyer_input.includes('20%')) {
       discount = 20;
    } else if (intent.buyer_input.toLowerCase().includes('for free')) {
       discount = 100;
    }
    if (policyFeedback && policyFeedback.metadata && policyFeedback.metadata.final_discount !== undefined) {
       discount = policyFeedback.metadata.final_discount;
    }

    let quantity = 1;
    const qtyMatch = intent.buyer_input.match(/(?:all\s+)?(\d+)\s*(?:available\s+)?(?:units?|items?|pcs?|pieces?)?/i);
    if (qtyMatch && parseInt(qtyMatch[1], 10) > 0 && !intent.buyer_input.includes('₹' + qtyMatch[1]) && !intent.buyer_input.includes(qtyMatch[1] + '%')) {
      quantity = parseInt(qtyMatch[1], 10);
    }

    result = {
      proposed_action: {
        type: discount > 0 ? 'APPLY_DISCOUNT' : 'CREATE_ORDER',
        product_id: candidate.product_id,
        discount_percent: discount,
        quantity,
        amount: candidate.price * quantity * (1 - discount / 100),
        base_price: candidate.price
      },
      reasoning: 'Stub negotiation'
    };
  } else {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
    
    try {
      const startGemini = performance.now();
      const response = await generateContentWithRetry(ai, {
        model: 'gemini-2.5-flash',
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
      if (tracer) tracer.recordStage(stage, startGemini, 'SUCCESS', undefined, undefined, 'gemini-2.5-flash', usageMetadata);
      
      const rawText = response.text || '{}';
      const parsed = JSON.parse(rawText);
      const startSchema = performance.now();
      const { ProposedActionSchema } = await import('@policyshield/shared');
      const actionParse = ProposedActionSchema.safeParse(parsed.proposed_action);
      
      if (actionParse.success && typeof parsed.reasoning === 'string') {
        if (tracer) tracer.recordStage('SCHEMA', startSchema, 'SUCCESS');
        result = {
          proposed_action: actionParse.data as ProposedAction,
          reasoning: parsed.reasoning
        };
      } else {
        if (tracer) tracer.recordStage('SCHEMA', startSchema, 'FAILURE', undefined, 'NEGOTIATION_SCHEMA_ERROR');
        result = {
          proposed_action: (actionParse.success ? actionParse.data : parsed.proposed_action) as ProposedAction,
          reasoning: parsed.reasoning || 'Default negotiation'
        };
      }
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
