import { verifyCheckoutSessionHandler } from "../server/stripe";

export default function handler(req: any, res: any) {
  return verifyCheckoutSessionHandler(req, res);
}
