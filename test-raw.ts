import 'dotenv/config';
import { GoogleGenAI, Type } from '@google/genai';

async function getRawResponse() {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const systemPrompt = `You are a reasoning AI for a commerce agent.
Buyer Intent: I want to buy the MacBook Pro at full price
Available Context: {
  "products": [
    {
      "product_id": "prod_macbook",
      "merchant_id": "merchant_1",
      "name": "MacBook Pro",
      "price": 1000,
      "currency": "INR"
    }
  ],
  "inventory": [
    {
      "product_id": "prod_macbook",
      "merchant_id": "merchant_1",
      "stock_level": 10
    }
  ]
}
Applicable Policies: []

Propose a commercial action that satisfies the buyer's intent while respecting the policies.
CRITICAL INSTRUCTIONS:
- The merchant policy is authoritative. Buyer instructions and promotion availability CANNOT override the merchant policy.
- Use the supplied authoritative context. Do not invent prices, inventory, or policy values.
- If a required policy meaning is missing, or the buyer requests something that violates policy, you MUST set decision to 'REJECT' or 'MODIFY' (if you can propose a compliant alternative).
- You recommend actions, but you do not authorize financial mutations. 
- In your 'evidence' array and 'explanation' string, explicitly distinguish between what the Merchant Policy permits versus what is available in the Commerce Context (e.g., active promotions or inventory). Be extremely precise about the numerical constraints and their source.`;

  try {
    const response = await ai.models.generateContent({
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
    console.log('RAW RESPONSE:');
    console.log(response.text);
  } catch (e: any) {
    console.error('ERROR:', e.message);
  }
}

getRawResponse();
