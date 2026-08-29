import assert from 'assert';
import { RazorpayAdapter } from '../execution/razorpay';
import { executeAction } from '../execution/executor';

// Mock DB and Razorpay for unit testing the conversion
async function testAmountConversion() {
  console.log('Testing Razorpay amount conversion...');
  
  // We want to test that amountInPaise goes straight through without double conversion
  // Since we don't have vitest fully set up yet (it skips tests), we will run this manually via tsx
  
  process.env.STUB_AI = '1';
  
  const result = await RazorpayAdapter.createOrder(100000, 'INR', 'receipt_123');
  
  assert.strictEqual(result.amount, 100000, 'Amount must be exactly 100000 paise for ₹1,000');
  
  console.log('✅ Amount conversion test passed: ₹1,000 correctly sent as 100000 paise.');
}

if (require.main === module) {
  testAmountConversion().catch(e => {
    console.error('❌ Amount conversion test failed:', e);
    process.exit(1);
  });
}
