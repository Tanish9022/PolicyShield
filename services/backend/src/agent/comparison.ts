import { GoogleGenAI, Type } from '@google/genai';
import { generateContentWithRetry } from './gemini-utils';
import { IntentRequest, ProductCandidate, BuyerDecision } from '@policyshield/shared';
import { TelemetryTracer } from '../gateway/telemetry';

/**
 * Compare discovered candidates and select the best one based on buyer intent.
 */
export async function compareCandidates(
  intent: IntentRequest,
  candidates: ProductCandidate[],
  tracer?: TelemetryTracer
): Promise<BuyerDecision> {
  const startTotal = performance.now();

  if (candidates.length === 0) {
    return {
      decision: 'NO_MATCH',
      reasoning_evidence: ['No candidates discovered matching the criteria.'],
      next_step: 'ESCALATE'
    };
  }

  if (candidates.length === 1) {
    return {
      decision: 'SELECT',
      selected_product_id: candidates[0].product_id,
      reasoning_evidence: ['Only one candidate met the criteria.'],
      next_step: 'NEGOTIATING'
    };
  }

  if (!process.env.GEMINI_API_KEY && !process.env.STUB_AI) {
    throw new Error('GEMINI_API_KEY is not set');
  }

  const systemPrompt = `You are an AI Commerce Buyer.
The buyer wants: "${intent.buyer_input}"

Here are the authoritative candidates available:
${JSON.stringify(candidates, null, 2)}

Your task: Compare these candidates based on specifications, price, inventory, and delivery options, and select the BEST base product for the buyer.
Return a structured decision.

Constraints:
- You must select exactly ONE product_id from the candidates.
- If the buyer is requesting a discount, price-match, or negotiation, DO NOT escalate. Simply select the best matching base product. The discount negotiation will be handled in the next step of the pipeline.
- Base your reasoning strictly on the provided candidates data. Do not invent any values.
`;

  let decision: BuyerDecision;

  if (process.env.STUB_AI) {
    // Stub: just pick the first one
    decision = {
      decision: 'SELECT',
      selected_product_id: candidates[0].product_id,
      reasoning_evidence: ['Selected the first available candidate.'],
      next_step: 'NEGOTIATING'
    };
  } else {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
    
    try {
      const startGemini = performance.now();
      const response = await generateContentWithRetry(ai, {
        model: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
        contents: systemPrompt,
        config: {
          temperature: 0,
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              decision: { type: Type.STRING, enum: ['SELECT', 'ESCALATE'] },
              selected_product_id: { type: Type.STRING },
              reasoning_evidence: { type: Type.ARRAY, items: { type: Type.STRING } },
            },
            required: ['decision', 'selected_product_id', 'reasoning_evidence']
          }
        }
      });
      
      const usageMetadata = response.usageMetadata ? {
         inputTokens: response.usageMetadata.promptTokenCount,
         outputTokens: response.usageMetadata.candidatesTokenCount,
         totalTokens: response.usageMetadata.totalTokenCount
      } : {};
      
      if (tracer) tracer.recordStage('COMPARISON_GEMINI', startGemini, 'SUCCESS', undefined, undefined, 'gemini-2.5-flash', usageMetadata);
      
      const rawText = response.text || '{}';
      const parsed = JSON.parse(rawText);
      const startSchema = performance.now();
      const { ComparisonOutputSchema } = await import('@policyshield/shared');
      const validated = ComparisonOutputSchema.safeParse(parsed);
      if (validated.success) {
        if (tracer) tracer.recordStage('SCHEMA', startSchema, 'SUCCESS');
        decision = {
          decision: validated.data.decision,
          selected_product_id: validated.data.selected_product_id || undefined,
          reasoning_evidence: validated.data.reasoning_evidence,
          next_step: validated.data.decision === 'SELECT' ? 'NEGOTIATING' : 'ESCALATE'
        };
      } else {
        if (tracer) tracer.recordStage('SCHEMA', startSchema, 'FAILURE', undefined, 'COMPARISON_SCHEMA_ERROR');
        decision = {
          decision: parsed.decision || 'ESCALATE',
          selected_product_id: parsed.selected_product_id,
          reasoning_evidence: parsed.reasoning_evidence || [],
          next_step: parsed.decision === 'SELECT' ? 'NEGOTIATING' : 'ESCALATE'
        };
      }
    } catch (e: any) {
      if (tracer) tracer.recordStage('COMPARISON_GEMINI', startTotal, 'FAILURE', undefined, e.message);
      throw e;
    }
  }

  // Safety verification: ensure selected_product_id is valid
  if (decision.decision === 'SELECT') {
    const valid = candidates.find(c => c.product_id === decision.selected_product_id);
    if (!valid) {
       decision.decision = 'ESCALATE';
       decision.reasoning_evidence.push('AI selected an invalid or non-existent product_id.');
       decision.next_step = 'ESCALATE';
    }
  }

  if (tracer) tracer.recordStage('COMPARISON', startTotal, 'SUCCESS', undefined, undefined, undefined, { selected: decision.selected_product_id });

  return decision;
}
