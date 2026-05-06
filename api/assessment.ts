import { assessmentHandler } from "../server/assessment.js";

export default function handler(req: any, res: any) {
  return assessmentHandler(req, res);
}
