/** `size`: a sticker size key (default "3in"; none for totes); `quantity`: 1–10 (default 1). T111. */
export type PlaceOrderInput = { buyerName: string; buyerEmail?: string; shipNote?: string; size?: string; quantity?: number };
export type PlaceOrderResult = { orderId: string; token: string };

export interface PaymentProvider {
  readonly mode: "staged" | "stripe";
  placeOrder(productId: string, input: PlaceOrderInput): Promise<PlaceOrderResult>;
}
