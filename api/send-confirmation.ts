import { sendConfirmationHandler } from "../server/confirmation.js";

export default function handler(req: any, res: any) {
  return sendConfirmationHandler(req, res);
}
