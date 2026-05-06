import { verifyCheckoutSessionHandler } from "../server/stripe.js";

export default function handler(req: any, res: any) {
  return verifyCheckoutSessionHandler(req, res);
}
