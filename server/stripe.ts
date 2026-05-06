type BillingData = {
  firstName?: string;
  lastName?: string;
  company?: string;
  street?: string;
  zip?: string;
  city?: string;
  country?: string;
};

type CheckoutRequest = {
  email?: string;
  billingData?: BillingData;
  answers?: {
    airport?: string;
    destination?: string;
    time?: string;
    problem?: string;
  };
  reference?: string;
};

type Env = Record<string, string | undefined>;

export function readJsonBody(req: any): Promise<unknown> {
  return new Promise((resolve, reject) => {
    let body = "";

    req.on("data", (chunk: any) => {
      body += chunk.toString();
    });

    req.on("end", () => {
      try {
        resolve(body ? JSON.parse(body.replace(/^\uFEFF/, "")) : {});
      } catch (error) {
        reject(error);
      }
    });

    req.on("error", reject);
  });
}

export function sendJson(res: any, statusCode: number, payload: unknown) {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(payload));
}

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function getOrigin(req: any, env: Env) {
  const configuredUrl = env.SITE_URL || env.VERCEL_PROJECT_PRODUCTION_URL || env.VERCEL_URL;

  if (configuredUrl) {
    return configuredUrl.startsWith("http") ? configuredUrl : `https://${configuredUrl}`;
  }

  const proto = req.headers["x-forwarded-proto"] || "http";
  const host = req.headers["x-forwarded-host"] || req.headers.host || "localhost:5173";
  return `${proto}://${host}`;
}

function toCountryCode(country: string | undefined) {
  const normalized = String(country || "").trim().toLowerCase();

  if (!normalized || normalized === "deutschland" || normalized === "germany") {
    return "DE";
  }

  if (normalized.length === 2) {
    return normalized.toUpperCase();
  }

  return "DE";
}

function limitMetadata(value: unknown) {
  return String(value || "").slice(0, 500);
}

function getSafeErrorMessage(error: unknown) {
  return error instanceof Error && error.message ? error.message : "Unknown server error";
}

function getPaymentMethodTypes(env: Env) {
  if (env.STRIPE_DYNAMIC_PAYMENT_METHODS === "true") {
    return [];
  }

  return String(env.STRIPE_PAYMENT_METHOD_TYPES || "card")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

async function stripeRequest(env: Env, path: string, params?: URLSearchParams, method = "POST") {
  const secretKey = env.STRIPE_SECRET_KEY;

  if (!secretKey) {
    return {
      ok: false,
      status: 503,
      data: { error: "Stripe secret key is not configured" }
    };
  }

  const response = await fetch(`https://api.stripe.com/v1${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${secretKey}`,
      ...(params ? { "Content-Type": "application/x-www-form-urlencoded" } : {})
    },
    body: params
  });
  const data = await response.json().catch(() => null);

  return {
    ok: response.ok,
    status: response.status,
    data
  };
}

async function createCustomer(env: Env, payload: CheckoutRequest) {
  const billing = payload.billingData || {};
  const name = [billing.firstName, billing.lastName].filter(Boolean).join(" ").trim();
  const params = new URLSearchParams();

  params.append("email", String(payload.email || "").trim());

  if (name) {
    params.append("name", name);
  }

  if (billing.company) {
    params.append("metadata[company]", limitMetadata(billing.company));
  }

  params.append("address[line1]", String(billing.street || "").trim());
  params.append("address[postal_code]", String(billing.zip || "").trim());
  params.append("address[city]", String(billing.city || "").trim());
  params.append("address[country]", toCountryCode(billing.country));

  return stripeRequest(env, "/customers", params);
}

export async function createCheckoutSessionHandler(req: any, res: any, env: Env = process.env) {
  if (req.method !== "POST") {
    sendJson(res, 405, { error: "Method not allowed" });
    return;
  }

  try {
    const payload = (await readJsonBody(req)) as CheckoutRequest;
    const email = String(payload.email || "").trim();
    const billing = payload.billingData || {};

    if (!isValidEmail(email)) {
      sendJson(res, 400, { error: "Valid email is required" });
      return;
    }

    if (!billing.firstName || !billing.lastName || !billing.street || !billing.zip || !billing.city) {
      sendJson(res, 400, { error: "Billing data is incomplete" });
      return;
    }

    const customerResponse = await createCustomer(env, payload);

    if (!customerResponse.ok) {
      sendJson(res, customerResponse.status, { error: "Stripe customer creation failed", details: customerResponse.data });
      return;
    }

    const origin = getOrigin(req, env);
    const reference = payload.reference || `PN-${Date.now()}`;
    const unitAmount = Number(env.STRIPE_PRICE_CENTS || "4900");
    const currency = (env.STRIPE_CURRENCY || "eur").toLowerCase();
    const params = new URLSearchParams();

    params.append("mode", "payment");
    params.append("customer", customerResponse.data.id);
    params.append("client_reference_id", reference);
    params.append("success_url", `${origin}/?checkout=success&session_id={CHECKOUT_SESSION_ID}`);
    params.append("cancel_url", `${origin}/?checkout=cancel`);
    params.append("billing_address_collection", "required");
    params.append("phone_number_collection[enabled]", "true");
    params.append("tax_id_collection[enabled]", "true");
    params.append("allow_promotion_codes", env.STRIPE_ALLOW_PROMOTION_CODES === "true" ? "true" : "false");
    params.append("customer_update[name]", "auto");
    params.append("customer_update[address]", "auto");
    params.append("submit_type", "pay");
    params.append("line_items[0][quantity]", "1");
    params.append("line_items[0][price_data][currency]", currency);
    params.append("line_items[0][price_data][unit_amount]", String(unitAmount));
    params.append("line_items[0][price_data][tax_behavior]", "inclusive");
    params.append("line_items[0][price_data][product_data][name]", env.STRIPE_PRODUCT_NAME || "PassNotfall Sofort-Auswertung");
    params.append(
      "line_items[0][price_data][product_data][description]",
      "Private digitale Orientierungshilfe bei Reisepass-, Ausweis- und Dokumentproblemen vor dem Flug."
    );
    params.append("invoice_creation[enabled]", "true");
    params.append("invoice_creation[invoice_data][description]", "PassNotfall Sofort-Auswertung");
    params.append(
      "invoice_creation[invoice_data][footer]",
      "PassNotfall ist ein privater Anbieter. Keine Behörde, kein amtliches Dokument und keine Garantie für Boarding oder Einreise."
    );
    params.append("metadata[passnotfall_reference]", reference);
    params.append("metadata[email]", email);
    params.append("metadata[airport]", limitMetadata(payload.answers?.airport));
    params.append("metadata[destination]", limitMetadata(payload.answers?.destination));
    params.append("metadata[time]", limitMetadata(payload.answers?.time));
    params.append("metadata[problem]", limitMetadata(payload.answers?.problem));
    params.append("payment_intent_data[metadata][passnotfall_reference]", reference);
    params.append("payment_intent_data[metadata][email]", email);

    getPaymentMethodTypes(env).forEach((paymentMethodType, index) => {
      params.append(`payment_method_types[${index}]`, paymentMethodType);
    });

    if (env.STRIPE_TAX_RATE_ID) {
      params.append("line_items[0][tax_rates][0]", env.STRIPE_TAX_RATE_ID);
    } else if (env.STRIPE_AUTOMATIC_TAX === "true") {
      params.append("automatic_tax[enabled]", "true");
    }

    const sessionResponse = await stripeRequest(env, "/checkout/sessions", params);

    if (!sessionResponse.ok) {
      sendJson(res, sessionResponse.status, { error: "Stripe checkout session creation failed", details: sessionResponse.data });
      return;
    }

    sendJson(res, 200, {
      id: sessionResponse.data.id,
      url: sessionResponse.data.url
    });
  } catch (error) {
    sendJson(res, 500, { error: "Checkout session failed", details: { message: getSafeErrorMessage(error) } });
  }
}

export async function verifyCheckoutSessionHandler(req: any, res: any, env: Env = process.env) {
  if (req.method !== "GET") {
    sendJson(res, 405, { error: "Method not allowed" });
    return;
  }

  try {
    const host = req.headers.host || "localhost";
    const url = new URL(req.url || "", `http://${host}`);
    const sessionId = url.searchParams.get("session_id");

    if (!sessionId || !sessionId.startsWith("cs_")) {
      sendJson(res, 400, { error: "Valid session_id is required" });
      return;
    }

    const params = new URLSearchParams();
    params.append("expand[]", "invoice");
    params.append("expand[]", "customer");
    const response = await stripeRequest(env, `/checkout/sessions/${encodeURIComponent(sessionId)}?${params.toString()}`, undefined, "GET");

    if (!response.ok) {
      sendJson(res, response.status, { error: "Stripe session lookup failed", details: response.data });
      return;
    }

    const session = response.data;
    const invoice = session.invoice && typeof session.invoice === "object" ? session.invoice : null;

    sendJson(res, 200, {
      id: session.id,
      status: session.status,
      payment_status: session.payment_status,
      amount_total: session.amount_total,
      currency: session.currency,
      customer_email: session.customer_details?.email || session.customer_email,
      reference: session.client_reference_id || session.metadata?.passnotfall_reference,
      invoice: invoice
        ? {
            id: invoice.id,
            number: invoice.number,
            hosted_invoice_url: invoice.hosted_invoice_url,
            invoice_pdf: invoice.invoice_pdf,
            status: invoice.status
          }
        : null
    });
  } catch (error) {
    sendJson(res, 500, { error: "Checkout verification failed", details: { message: getSafeErrorMessage(error) } });
  }
}
