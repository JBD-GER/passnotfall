import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { readJsonBody, sendJson } from "./stripe";
import { updateCaseByToken } from "./supabase";

type Env = Record<string, string | undefined>;

type ConfirmationPayload = {
  email?: string;
  accessToken?: string;
  accessUrl?: string;
  stripeInvoiceUrl?: string;
  stripeInvoiceNumber?: string;
  answers?: Record<string, unknown>;
  billingData?: Record<string, unknown>;
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
  wrapText(assessment.headline || "Dein Notfallplan liegt vor", 62)
    .slice(0, 2)
    .forEach((line, index) => {
      page.drawText(line, { x: 62, y: y - 78 - index * 14, size: 12, font: bold, color: black });
    });

  y = 560;

  function drawSection(title: string, lines: string[]) {
    page.drawText(title, { x: 42, y, size: 13, font: bold, color: blue });
    y -= 20;

    for (const item of lines.filter(Boolean)) {
      for (const line of wrapText(item, 86)) {
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
  drawSection("Nächste Schritte", (assessment.steps || []).map((step, index) => `${index + 1}. ${step}`));
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
  if (payload.accessUrl) {
    drawSection("Privater Zugriffslink", [payload.accessUrl]);
  }

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

function createEmailHtml(payload: ConfirmationPayload, reference: string, accessUrl: string) {
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
            <p style="margin:0 0 16px;"><a href="${escapeHtml(accessUrl)}" style="display:inline-block;background:#D7262E;color:#ffffff;text-decoration:none;font-weight:900;padding:13px 18px;border-radius:8px;">Fall erneut öffnen</a></p>
            <div style="padding:16px 18px;background:#f7faff;border:1px solid #cdd9e8;border-radius:10px;margin:20px 0;">
              <strong style="display:block;color:#D7262E;font-size:13px;margin-bottom:6px;">Jetzt zuerst</strong>
              <span style="display:block;color:#091827;font-size:18px;line-height:1.35;font-weight:900;">${escapeHtml(assessment.primaryAction || "Prüfe die nächsten Schritte in deiner PDF-Bestätigung.")}</span>
            </div>
            <ol style="padding-left:20px;margin:0 0 22px;color:#091827;font-weight:800;line-height:1.55;">
              ${steps.map((step) => `<li style="margin:0 0 8px;">${escapeHtml(step)}</li>`).join("")}
            </ol>
            ${payload.stripeInvoiceUrl ? `<p style="margin:0 0 16px;color:#40546b;font-size:15px;line-height:1.6;">Rechnung: <a href="${escapeHtml(payload.stripeInvoiceUrl)}">${escapeHtml(payload.stripeInvoiceNumber || "Stripe-Rechnung öffnen")}</a></p>` : ""}
            <p style="margin:0;color:#65758b;font-size:12px;line-height:1.5;">
              Referenz: ${escapeHtml(reference)}<br />
              Privater Link: ${escapeHtml(accessUrl)}<br />
              PassNotfall ist ein privater Anbieter. Diese E-Mail und das PDF sind keine amtlichen Dokumente und ersetzen keine verbindliche Auskunft.
            </p>
          </div>
        </div>
      </div>
    </div>
  `;
}

function createEmailText(payload: ConfirmationPayload, reference: string, accessUrl: string) {
  const assessment = payload.assessment || {};

  return [
    "Deine PassNotfall-Bestätigung",
    `Referenz: ${reference}`,
    "",
    assessment.headline || "Dein Notfallplan liegt vor",
    assessment.verdict || "",
    "",
    "Fall erneut öffnen:",
    accessUrl,
    "",
    "Jetzt zuerst:",
    assessment.primaryAction || "",
    "",
    "Nächste Schritte:",
    (assessment.steps || []).map((step, index) => `${index + 1}. ${step}`).join("\n"),
    "",
    payload.stripeInvoiceUrl ? `Rechnung: ${payload.stripeInvoiceUrl}` : "",
    "",
    "Hinweis: PassNotfall ist ein privater Anbieter. Diese E-Mail und das PDF sind keine amtlichen Dokumente."
  ].join("\n");
}

export async function sendConfirmationHandler(req: any, res: any, env: Env = process.env) {
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
    const accessUrl = payload.accessUrl || "";
    const pdfBytes = await createConfirmationPdf({ ...payload, accessUrl }, reference);
    const pdfBase64 = Buffer.from(pdfBytes).toString("base64");
    const subject = `Deine PassNotfall-Bestätigung ${reference}`;
    const html = createEmailHtml(payload, reference, accessUrl);
    const text = createEmailText(payload, reference, accessUrl);
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

    if (payload.accessToken) {
      await updateCaseByToken(payload.accessToken, {
        status: "completed",
        answers: payload.answers || {},
        billing_data: payload.billingData || {},
        assessment: payload.assessment || {},
        access_url: accessUrl,
        stripe_invoice_url: payload.stripeInvoiceUrl || null,
        stripe_invoice_number: payload.stripeInvoiceNumber || null,
        confirmation_email_id: data?.id || null,
        confirmation_reference: reference,
        confirmation_sent_at: new Date().toISOString()
      }).catch(() => null);
    }

    sendJson(res, 200, { id: data?.id, reference, accessUrl });
  } catch {
    sendJson(res, 500, { error: "Confirmation email failed" });
  }
}
