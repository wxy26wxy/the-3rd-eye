export type PlaceOrderInput = { buyerName: string; buyerEmail?: string; shipNote?: string };
export type PlaceOrderResult = { orderId: string; token: string };

export interface PaymentProvider {
  readonly mode: "staged" | "stripe";
  placeOrder(productId: string, input: PlaceOrderInput): Promise<PlaceOrderResult>;
}
