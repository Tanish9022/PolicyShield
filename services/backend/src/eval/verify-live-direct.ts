import dotenv from 'dotenv';
dotenv.config();

import { GoogleGenAI } from '@google/genai';
import Razorpay from 'razorpay';

async function verifyLiveCredentials() {
  console.log('==================================================');
  console.log('LIVE VERIFICATION TEST (0% FABRICATION, 100% REAL APIS)');
  console.log('==================================================\n');

  // 1. Live Google Gemini Call
  console.log('1. Calling Google Gemini API directly (gemini-3.6-flash)...');
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
    const t0 = Date.now();
    const response = await ai.models.generateContent({
      model: 'gemini-3.6-flash',
      contents: 'Respond ONLY with a JSON object: {"ping": "pong", "time": "now"}',
      config: {
        temperature: 0,
        responseMimeType: 'application/json'
      }
    });
    const duration = Date.now() - t0;
    console.log(`✅ Google Gemini Responded in ${duration}ms:`);
    console.log(`   Raw Output: ${response.text?.trim()}`);
  } catch (err: any) {
    console.error('❌ Gemini Error:', err.message || err);
  }

  // 2. Live Razorpay Call
  console.log('\n2. Calling Razorpay Test API directly (orders.create)...');
  try {
    const rzp = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID!,
      key_secret: process.env.RAZORPAY_KEY_SECRET!
    });
    const receipt = `real_${Date.now()}`;
    const t0 = Date.now();
    const order = await rzp.orders.create({
      amount: 15000,
      currency: 'INR',
      receipt: receipt
    });
    const duration = Date.now() - t0;
    console.log(`✅ Razorpay Test Mode Order Created in ${duration}ms:`);
    console.log(`   Order ID: ${order.id}`);
    console.log(`   Receipt:  ${order.receipt}`);
    console.log(`   Amount:   ₹${order.amount / 100}`);
    console.log(`   Status:   ${order.status}`);
  } catch (err: any) {
    console.error('❌ Razorpay Error:', err.message || err);
  }

  console.log('\n==================================================');
}

verifyLiveCredentials();
