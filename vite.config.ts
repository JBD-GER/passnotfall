import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { assessmentHandler } from "./server/assessment";
import { sendConfirmationHandler } from "./server/confirmation";
import { createCheckoutSessionHandler, verifyCheckoutSessionHandler } from "./server/stripe";

type ConfirmationPayload = {
  email?: string;
  answers?: Record<string, unknown>;
  assessment?: {
    headline?: string;
    verdict?: string;
    risk?: string;
    primaryAction?: string;
    route?: string;
    airport?: {
      office?: string;
      address?: string;
      phone?: string;
      note?: string;
    };
    documents?: string[];
    steps?: string[];
    warnings?: string[];
  };
};

function readJsonBody(req: any): Promise<unknown> {
  return new Promise((resolve, reject) => {
    let body = "";

    req.on("data", (chunk: any) => {
      body += chunk.toString();
    });

    req.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (error) {
        reject(error);
      }
    });

    req.on("error", reject);
  });
}

function sendJson(res: any, statusCode: number, payload: unknown) {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(payload));
}

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function wrapText(text: string, maxChars: number) {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";

  for (const word of words) {
    const nextLine = line ? `${line} ${word}` : word;

    if (nextLine.length > maxChars && line) {
      lines.push(line);
      line = word;
    } else {
      line = nextLine;
    }
  }

  if (line) {
    lines.push(line);
  }

  return lines;
}

async function createConfirmationPdf(payload: ConfirmationPayload, reference: string) {
  const assessment = payload.assessment || {};
  const airport = assessment.airport || {};
  const answers = payload.answers || {};
  const affectedPersons = Array.isArray(answers.affectedPersons)
    ? answers.affectedPersons
        .map((person: any, index: number) => {
          const label = person?.label || `Person ${index + 1}`;
          const ageGroup = person?.ageGroup || "Alter nicht angegeben";
          const problem = person?.problem || "Problem nicht angegeben";
          return `${label} (${ageGroup}): ${problem}`;
        })
        .join("; ")
    : String(answers.problem || "-");
  const pdfDoc = await PDFDocument.create();
  let page = pdfDoc.addPage([595, 842]);
  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const regular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const blue = rgb(0, 0.231, 0.471);
  const red = rgb(0.843, 0.149, 0.18);
  const muted = rgb(0.38, 0.46, 0.56);
  const lightBlue = rgb(0.94, 0.97, 1);
  const black = rgb(0.035, 0.094, 0.153);
  let y = 790;

  try {
    const logoBytes = await readFile(join(process.cwd(), "public", "Logo_Passnotfall.png"));
    const logo = await pdfDoc.embedPng(logoBytes);
    page.drawImage(logo, { x: 42, y: 756, width: 160, height: 53 });
  } catch {
    page.drawText("PassNotfall", { x: 42, y: 778, size: 20, font: bold, color: blue });
  }

  page.drawText("Bestätigung", { x: 420, y: 785, size: 16, font: bold, color: blue });
  page.drawText(reference, { x: 420, y: 764, size: 10, font: regular, color: muted });
  page.drawText(new Date().toLocaleString("de-DE"), { x: 420, y: 749, size: 10, font: regular, color: muted });

  y = 710;
  page.drawRectangle({ x: 42, y: y - 100, width: 511, height: 100, color: lightBlue, borderColor: rgb(0.84, 0.89, 0.95), borderWidth: 1 });
  page.drawRectangle({ x: 42, y: y - 100, width: 5, height: 100, color: red });
  page.drawText("Bestätigung deiner PassNotfall-Auswertung", { x: 62, y: y - 28, size: 20, font: bold, color: blue });
  page.drawText("Privater Anbieter. Keine Behörde. Kein amtliches Dokument.", { x: 62, y: y - 52, size: 10, font: bold, color: red });
  const headlineLines = wrapText(assessment.headline || "Dein Notfallplan liegt vor", 62).slice(0, 2);
  headlineLines.forEach((line, index) => {
    page.drawText(line, { x: 62, y: y - 78 - index * 14, size: 12, font: bold, color: black });
  });

  y = 560;

  function drawSection(title: string, lines: string[]) {
    page.drawText(title, { x: 42, y, size: 13, font: bold, color: blue });
    y -= 20;

    for (const item of lines.filter(Boolean)) {
      const wrapped = wrapText(item, 86);
      for (const line of wrapped) {
        if (y < 80) {
          page = pdfDoc.addPage([595, 842]);
          y = 780;
        }
        page.drawText(line, { x: 58, y, size: 10.5, font: regular, color: black });
        y -= 14;
      }
      y -= 4;
    }

    y -= 14;
  }

  drawSection("Kernempfehlung", [
    `Risiko: ${assessment.risk || "nicht bewertet"}`,
    assessment.verdict || "",
    assessment.primaryAction || "",
    assessment.route ? `Empfohlener Weg: ${assessment.route}` : ""
  ]);

  drawSection(
    "Nächste Schritte",
    (assessment.steps || []).map((step, index) => `${index + 1}. ${step}`)
  );

  drawSection("Zuständige Stelle", [
    airport.office || "",
    airport.address || "",
    airport.phone ? `Telefon: ${airport.phone}` : "",
    airport.note ? `Hinweis: ${airport.note}` : ""
  ]);

  drawSection("Deine Angaben", [
    `Flughafen: ${answers.airport || "-"}`,
    `Zielland: ${answers.destination || "-"}`,
    `Zeitfenster: ${answers.time || "-"}`,
    `Betroffene Personen: ${affectedPersons}`,
    `Vorhandene Unterlagen: ${Array.isArray(answers.documents) ? answers.documents.join(", ") : "-"}`
  ]);

  drawSection("Einpacken", assessment.documents || []);

  page.drawRectangle({ x: 42, y: 34, width: 511, height: 34, color: rgb(1, 0.96, 0.96), borderColor: rgb(0.96, 0.72, 0.73), borderWidth: 1 });
  page.drawText("Hinweis: Diese Bestätigung ersetzt keine verbindliche Auskunft von Airline, Behörde, Bundespolizei oder Konsulat.", {
    x: 52,
    y: 47,
    size: 8.5,
    font: bold,
    color: red
  });

  return pdfDoc.save();
}

function createConfirmationEmailHtml(payload: ConfirmationPayload, reference: string) {
  const assessment = payload.assessment || {};
  const steps = (assessment.steps || []).slice(0, 4);

  return `
    <div style="margin:0;padding:0;background:#eef5ff;font-family:Montserrat,Segoe UI,Arial,sans-serif;color:#091827;">
      <div style="max-width:680px;margin:0 auto;padding:28px 16px;">
        <div style="background:#ffffff;border-radius:14px;overflow:hidden;border:1px solid #dfe7f1;box-shadow:0 18px 44px rgba(0,59,120,.12);">
          <div style="padding:24px 28px;border-bottom:5px solid #D7262E;">
            <img src="https://www.passnotfall.de/Logo_Passnotfall.png" alt="PassNotfall" style="width:190px;max-width:70%;height:auto;display:block;" />
          </div>
          <div style="padding:28px;">
            <p style="margin:0 0 10px;color:#003B78;font-size:12px;font-weight:900;letter-spacing:.08em;text-transform:uppercase;">Deine Bestätigung</p>
            <h1 style="margin:0 0 14px;color:#003B78;font-size:30px;line-height:1.08;font-weight:900;">${escapeHtml(assessment.headline || "Dein Notfallplan liegt vor")}</h1>
            <p style="margin:0 0 20px;color:#40546b;font-size:16px;line-height:1.6;">${escapeHtml(assessment.verdict || "Im Anhang findest du deine PassNotfall-Auswertung als PDF.")}</p>
            <div style="padding:16px 18px;background:#f7faff;border:1px solid #cdd9e8;border-radius:10px;margin:20px 0;">
              <strong style="display:block;color:#D7262E;font-size:13px;margin-bottom:6px;">Jetzt zuerst</strong>
              <span style="display:block;color:#091827;font-size:18px;line-height:1.35;font-weight:900;">${escapeHtml(assessment.primaryAction || "Prüfe die nächsten Schritte in deiner PDF-Bestätigung.")}</span>
            </div>
            <ol style="padding-left:20px;margin:0 0 22px;color:#091827;font-weight:800;line-height:1.55;">
              ${steps.map((step) => `<li style="margin:0 0 8px;">${escapeHtml(step)}</li>`).join("")}
            </ol>
            <p style="margin:0 0 18px;color:#40546b;font-size:15px;line-height:1.6;">
              Wir drücken dir die Daumen, dass du die Situation schnell geklärt bekommst. Bewahre die PDF am besten griffbereit auf und gleiche die Angaben direkt mit Airline oder zuständiger Stelle ab.
            </p>
            <p style="margin:0;color:#65758b;font-size:12px;line-height:1.5;">
              Referenz: ${escapeHtml(reference)}<br />
              PassNotfall ist ein privater Anbieter. Diese E-Mail und das PDF sind keine amtlichen Dokumente und ersetzen keine verbindliche Auskunft.
            </p>
          </div>
        </div>
      </div>
    </div>
  `;
}

function createConfirmationEmailText(payload: ConfirmationPayload, reference: string) {
  const assessment = payload.assessment || {};
  const steps = (assessment.steps || []).map((step, index) => `${index + 1}. ${step}`).join("\n");

  return [
    "Deine PassNotfall-Bestätigung",
    `Referenz: ${reference}`,
    "",
    assessment.headline || "Dein Notfallplan liegt vor",
    assessment.verdict || "",
    "",
    "Jetzt zuerst:",
    assessment.primaryAction || "",
    "",
    "Nächste Schritte:",
    steps,
    "",
    "Wir drücken dir die Daumen, dass du die Situation schnell geklärt bekommst.",
    "",
    "Hinweis: PassNotfall ist ein privater Anbieter. Diese E-Mail und das PDF sind keine amtlichen Dokumente."
  ].join("\n");
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, ".", "");

  return {
    plugins: [
      react(),
      {
        name: "passnotfall-openai-api",
        configureServer(server) {
          server.middlewares.use("/api/create-checkout-session", async (req: any, res: any) => {
            await createCheckoutSessionHandler(req, res, env);
          });

          server.middlewares.use("/api/verify-checkout-session", async (req: any, res: any) => {
            await verifyCheckoutSessionHandler(req, res, env);
          });

          server.middlewares.use("/api/assessment", async (req: any, res: any) => {
            await assessmentHandler(req, res, env);
          });

          server.middlewares.use("/api/send-confirmation", async (req: any, res: any) => {
            await sendConfirmationHandler(req, res, env);
          });

          server.middlewares.use("/api/assessment", async (req: any, res: any) => {
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
          });

          server.middlewares.use("/api/send-confirmation", async (req: any, res: any) => {
            if (req.method !== "POST") {
              sendJson(res, 405, { error: "Method not allowed" });
              return;
            }

            const resendApiKey = env.RESEND_API_KEY;

            if (!resendApiKey) {
              sendJson(res, 503, { error: "Resend API key is not configured" });
              return;
            }

            try {
              const payload = (await readJsonBody(req)) as ConfirmationPayload;
              const email = String(payload.email || "").trim();

              if (!isValidEmail(email)) {
                sendJson(res, 400, { error: "Valid email is required" });
                return;
              }

              const reference = `PN-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${Math.random()
                .toString(36)
                .slice(2, 8)
                .toUpperCase()}`;
              const pdfBytes = await createConfirmationPdf(payload, reference);
              const pdfBase64 = Buffer.from(pdfBytes).toString("base64");
              const subject = `Deine PassNotfall-Bestätigung ${reference}`;
              const html = createConfirmationEmailHtml(payload, reference);
              const text = createConfirmationEmailText(payload, reference);

              const resendResponse = await fetch("https://api.resend.com/emails", {
                method: "POST",
                headers: {
                  Authorization: `Bearer ${resendApiKey}`,
                  "Content-Type": "application/json",
                  "Idempotency-Key": reference
                },
                body: JSON.stringify({
                  from: env.RESEND_FROM || "PassNotfall <onboarding@resend.dev>",
                  to: [email],
                  subject,
                  html,
                  text,
                  attachments: [
                    {
                      filename: `PassNotfall-Bestaetigung-${reference}.pdf`,
                      content: pdfBase64
                    }
                  ],
                  tags: [
                    { name: "source", value: "passnotfall" },
                    { name: "type", value: "confirmation" }
                  ]
                })
              });

              const data = await resendResponse.json().catch(() => null);

              if (!resendResponse.ok) {
                sendJson(res, resendResponse.status, { error: "Resend request failed", details: data });
                return;
              }

              sendJson(res, 200, { id: data?.id, reference });
            } catch {
              sendJson(res, 500, { error: "Confirmation email failed" });
            }
          });
        }
      }
    ]
  };
});
