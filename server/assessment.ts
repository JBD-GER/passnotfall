import { readJsonBody, sendJson } from "./stripe.js";

type Env = Record<string, string | undefined>;

export async function assessmentHandler(req: any, res: any, env: Env = process.env) {
  if (req.method !== "POST") {
    sendJson(res, 405, { error: "Method not allowed" });
    return;
  }

  const apiKey = env.OPENAI_API_KEY;

  if (!apiKey) {
    sendJson(res, 503, { error: "OpenAI API key is not configured" });
    return;
  }

  try {
    const payload = await readJsonBody(req);
    const openAiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: env.OPENAI_MODEL || "gpt-5-mini",
        messages: [
          {
            role: "system",
            content:
              "Du optimierst eine deutsche Notfall-Auswertung fuer Passprobleme vor dem Flug. " +
              "Antworte ausschliesslich als JSON-Objekt. Erfinde keine Telefonnummern, Adressen, Behoerden, Rechtsansprueche oder Einreisegarantien. " +
              "Nutze nur die uebergebenen Fakten. Schreibe direkt, knapp und handlungsorientiert. " +
              "Mache deutlich: private Orientierungshilfe, keine Behoerde, keine verbindliche Auskunft, keine Garantie fuer Boarding, Einreise oder Ersatzdokument."
          },
          {
            role: "user",
            content:
              "Erstelle eine bessere Ergebnisformulierung fuer diesen Fall. JSON-Shape: " +
              '{"headline":string,"verdict":string,"primaryAction":string,"route":string,"steps":string[],"warnings":string[]}. ' +
              JSON.stringify(payload)
          }
        ],
        response_format: { type: "json_object" },
        max_completion_tokens: 900
      })
    });

    if (!openAiResponse.ok) {
      sendJson(res, openAiResponse.status, { error: "OpenAI request failed" });
      return;
    }

    const data = await openAiResponse.json();
    const content = data.choices?.[0]?.message?.content;
    const assessment = content ? JSON.parse(content) : null;

    sendJson(res, 200, { assessment });
  } catch {
    sendJson(res, 500, { error: "Assessment generation failed" });
  }
}
