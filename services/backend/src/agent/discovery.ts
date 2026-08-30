import { GoogleGenAI, Type } from '@google/genai';
import { IntentRequest, CommerceContext, ProductCandidate } from '@policyshield/shared';
import { TelemetryTracer } from '../gateway/telemetry';

/**
 * Perform product discovery based on buyer intent.
 * The AI selects candidate product_ids from the catalog.
 * The backend strictly constructs the candidates from authoritative data.
 */
export async function discoverCandidates(
  intent: IntentRequest,
  context: CommerceContext,
  tracer?: TelemetryTracer
): Promise<ProductCandidate[]> {
  const startTotal = performance.now();
  
  if (!process.env.GEMINI_API_KEY && !process.env.STUB_AI) {
    throw new Error('GEMINI_API_KEY is not set');
  }

  // Authoritative catalog for AI to search
  const catalogForAI = context.products.map(p => ({
    product_id: p.product_id,
    name: p.name,
    base_price: context.prices[p.product_id],
    tags: p.tags,
    category: p.category
  }));

  const systemPrompt = `You are an AI Commerce Buyer.
The buyer wants: "${intent.buyer_input}"

Here is the available merchant catalog:
${JSON.stringify(catalogForAI, null, 2)}

Your task: Return an array of up to 3 product_ids from the catalog that best match the buyer's request.
Return an empty array if nothing matches (do NOT invent products).
`;

  let productIds: string[] = [];

  if (process.env.STUB_AI) {
    if (intent.buyer_input.includes('70,000') || intent.buyer_input.includes('60000')) {
      productIds = ['prod_dell'];
    } else if (intent.buyer_input.toLowerCase().includes('macbook')) {
      productIds = ['prod_macbook'];
    } else if (intent.buyer_input.toLowerCase().includes('dell xps')) {
      productIds = ['prod_laptop_2'];
    } else if (intent.buyer_input.toLowerCase().includes('laptop')) {
      productIds = ['prod_macbook'];
    } else {
      const q = intent.buyer_input.toLowerCase();
      const matched = catalogForAI.filter(p => q.includes(p.name.toLowerCase()));
      productIds = matched.slice(0, 3).map(p => p.product_id);
    }
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
              product_ids: { type: Type.ARRAY, items: { type: Type.STRING } }
            },
            required: ['product_ids']
          }
        }
      });
      
      const usageMetadata = response.usageMetadata ? {
         inputTokens: response.usageMetadata.promptTokenCount,
         outputTokens: response.usageMetadata.candidatesTokenCount,
         totalTokens: response.usageMetadata.totalTokenCount
      } : {};
      
      if (tracer) tracer.recordStage('DISCOVERY_GEMINI', startGemini, 'SUCCESS', undefined, undefined, 'gemini-3.6-flash', usageMetadata);
      
      const parsed = JSON.parse(response.text || '{}');
      productIds = parsed.product_ids || [];
    } catch (e: any) {
      if (tracer) tracer.recordStage('DISCOVERY_GEMINI', startTotal, 'FAILURE', undefined, e.message);
      throw e;
    }
  }

  // Construct final candidates using ONLY authoritative backend data
  const candidates: ProductCandidate[] = [];
  
  for (const pid of productIds) {
    const prod = context.products.find(p => p.product_id === pid);
    if (!prod) continue; // Safety: ignore AI hallucinations of product IDs
    
    // Find highest active promotion
    const applicablePromos = context.promotions.filter(promo => 
      promo.active && 
      (promo.applicable_product_ids.length === 0 || promo.applicable_product_ids.includes(pid))
    );
    let bestPromo = undefined;
    if (applicablePromos.length > 0) {
      bestPromo = applicablePromos.reduce((prev, current) => 
        (prev.discount_percent > current.discount_percent) ? prev : current
      );
    }
    
    // Check inventory
    const inventory = context.inventory[pid] || 0;
    
    // All available shipping
    const shipping = context.shipping;

    candidates.push({
      product_id: pid,
      name: prod.name,
      price: context.prices[pid],
      inventory: inventory,
      promotion: bestPromo,
      shipping: shipping,
      eligibility: inventory > 0 ? ['IN_STOCK'] : ['OUT_OF_STOCK']
    });
  }

  if (tracer) tracer.recordStage('DISCOVERY', startTotal, 'SUCCESS', undefined, undefined, undefined, { candidates_found: candidates.length });

  return candidates;
}
