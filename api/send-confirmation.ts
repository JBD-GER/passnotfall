import { sendConfirmationHandler } from "../server/confirmation";

export default function handler(req: any, res: any) {
  return sendConfirmationHandler(req, res);
}
