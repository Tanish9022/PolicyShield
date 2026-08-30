import dotenv from 'dotenv';
dotenv.config();

// Ensure STUB_RAZORPAY is disabled
process.env.STUB_RAZORPAY = '';
process.env.STUB_AI = '';

import { RazorpayAdapter } from '../execution/razorpay';
import { randomUUID } from 'crypto';

async function run() {
  console.log("=== STARTING REAL RAZORPAY TEST MODE EXECUTION ===");
  try {
    const amountInPaise = 10000; // 100 INR
    const currency = 'INR';
    const receipt = `receipt_${randomUUID()}`;
    
    console.log(`[REQ] Creating order with: { amount: ${amountInPaise}, currency: '${currency}', receipt: '${receipt}' }`);
    
    const start = performance.now();
    const order = await RazorpayAdapter.createOrder(amountInPaise, currency, receipt);
    const end = performance.now();
    
    console.log(`[RES] Order Created successfully in ${(end - start).toFixed(2)}ms`);
    console.log(JSON.stringify(order, null, 2));

    console.log("=== TEST COMPLETED SUCCESSFULLY ===");
  } catch (error) {
    console.error("=== TEST FAILED ===");
    console.error(error);
  }
}

run();
