import { createCheckoutSessionHandler } from "../server/stripe.js";

export default function handler(req: any, res: any) {
  return createCheckoutSessionHandler(req, res);
}
