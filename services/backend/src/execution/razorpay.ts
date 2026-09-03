import Razorpay from 'razorpay';
import crypto from 'crypto';

// Export a singleton or a simple object for DI.
// For evaluation mocking, we can just replace this object's methods.

export const RazorpayAdapter = {
  
  createOrder: async (amountInPaise: number, currency: string, receipt: string) => {
    if (process.env.STUB_RAZORPAY) {
      return { id: 'order_stub_' + Math.random().toString(36).substring(7), amount: amountInPaise, currency, receipt };
    }

    if (process.env.SIMULATE_TIMEOUT === 'true') {
      throw new Error('Simulated Razorpay API Timeout');
    }

    if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
      throw new Error('Razorpay credentials not configured');
    }

    const rzp = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET,
    });

    return await rzp.orders.create({
      amount: Math.round(amountInPaise),
      currency,
      receipt,
      payment_capture: true
    });
  },

  verifySignature: (body: string, signature: string, secret: string): boolean => {
    // Fail closed if the secret is missing or empty
    if (!secret || secret.trim() === '') {
      return false;
    }
    // Standard HMAC verification
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(body)
      .digest('hex');
    
    return expectedSignature === signature;
  },
  
  fetchOrder: async (orderId: string) => {
    if (process.env.STUB_RAZORPAY) {
      return { id: orderId, status: 'created' };
    }
    const rzp = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID!,
      key_secret: process.env.RAZORPAY_KEY_SECRET!,
    });
    return await rzp.orders.fetch(orderId);
  },

  fetchOrderByReceipt: async (receiptId: string): Promise<any | null> => {
    if (process.env.STUB_RAZORPAY) {
      if (receiptId.includes('fail')) return null;
      return { id: 'order_stub_recovered', receipt: receiptId, status: 'created' };
    }

    try {
      const rzp = new Razorpay({
        key_id: process.env.RAZORPAY_KEY_ID!,
        key_secret: process.env.RAZORPAY_KEY_SECRET!
      });
      
      const [recentRes, filteredRes] = await Promise.allSettled([
        rzp.orders.all({ count: 100 }),
        rzp.orders.all({ receipt: receiptId })
      ]);

      if (recentRes.status === 'fulfilled' && recentRes.value?.items) {
        const found = recentRes.value.items.find((o: any) => o.receipt === receiptId);
        if (found) return found;
      }

      if (filteredRes.status === 'fulfilled' && filteredRes.value?.items && filteredRes.value.items.length > 0) {
        return filteredRes.value.items[0];
      }

      return null;
    } catch (error) {
      console.error('Razorpay fetch error:', error);
      return null;
    }
  }
};
