import { getCaseByToken } from "../server/supabase.js";
import { sendJson } from "../server/stripe.js";

export default async function handler(req: any, res: any) {
  if (req.method !== "GET") {
    sendJson(res, 405, { error: "Method not allowed" });
    return;
  }

  try {
    const host = req.headers.host || "localhost";
    const url = new URL(req.url || "", `http://${host}`);
    const token = url.searchParams.get("token") || "";

    if (token.length < 32) {
      sendJson(res, 400, { error: "Valid token is required" });
      return;
    }

    const storedCase = await getCaseByToken(token);

    if (!storedCase) {
      sendJson(res, 404, { error: "Case not found" });
      return;
    }

    sendJson(res, 200, {
      reference: storedCase.reference,
      status: storedCase.status,
      customer_email: storedCase.customer_email,
      answers: storedCase.answers,
      billing_data: storedCase.billing_data,
      assessment: storedCase.assessment,
      access_url: storedCase.access_url,
      stripe_invoice_url: storedCase.stripe_invoice_url,
      stripe_invoice_number: storedCase.stripe_invoice_number,
      confirmation_reference: storedCase.confirmation_reference,
      created_at: storedCase.created_at,
      updated_at: storedCase.updated_at
    });
  } catch (error) {
    sendJson(res, 500, { error: error instanceof Error ? error.message : "Case lookup failed" });
  }
}
