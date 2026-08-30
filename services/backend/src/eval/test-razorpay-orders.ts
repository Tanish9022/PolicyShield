import dotenv from 'dotenv';
import path from 'path';
import Razorpay from 'razorpay';

dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });

async function listOrders() {
  const rzp = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID!,
    key_secret: process.env.RAZORPAY_KEY_SECRET!
  });
  
  console.log("Creating new order...");
  const receipt = `rec_${Date.now()}`;
  const order = await rzp.orders.create({
    amount: 100,
    currency: 'INR',
    receipt: receipt
  });
  console.log("Created order ID:", order.id, "Receipt:", receipt);

  console.log("Fetching orders with receipt:", receipt);
  const result = await rzp.orders.all({ receipt: receipt });
  console.log("Result items length:", result.items?.length);
  if (result.items?.length > 0) {
    console.log("Found order:", result.items[0]);
  } else {
    console.log("Not found by receipt filter. Fetching all orders...");
    const all = await rzp.orders.all();
    console.log("Total orders in list:", all.items?.length);
    console.log("First order details:", all.items?.[0]);
  }
}

listOrders();
