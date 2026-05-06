import { createCheckoutSessionHandler } from "../server/stripe";

export default function handler(req: any, res: any) {
  return createCheckoutSessionHandler(req, res);
}
