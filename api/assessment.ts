import { assessmentHandler } from "../server/assessment";

export default function handler(req: any, res: any) {
  return assessmentHandler(req, res);
}
