import { createHash, randomBytes } from "node:crypto";

type Env = Record<string, string | undefined>;

type CaseInsert = {
  reference: string;
  customer_email: string;
  billing_data: unknown;
  answers: unknown;
  status?: string;
};

export function createAccessToken() {
  return randomBytes(32).toString("base64url");
}

export function hashAccessToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function getSupabaseConfig(env: Env = process.env) {
  const url = env.SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error("Supabase is not configured");
  }

  return {
    url: url.replace(/\/$/, ""),
    key
  };
}

async function supabaseRequest(env: Env, path: string, init: RequestInit = {}) {
  const config = getSupabaseConfig(env);
  const response = await fetch(`${config.url}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: config.key,
      Authorization: `Bearer ${config.key}`,
      "Content-Type": "application/json",
      ...(init.headers || {})
    }
  });
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;

  if (!response.ok) {
    throw new Error(data?.message || data?.hint || `Supabase request failed with ${response.status}`);
  }

  return data;
}

export async function createPassnotfallCase(input: CaseInsert, env: Env = process.env) {
  const accessToken = createAccessToken();
  const accessTokenHash = hashAccessToken(accessToken);
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 90).toISOString();
  const rows = await supabaseRequest(env, "passnotfall_cases?select=id,reference", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({
      reference: input.reference,
      access_token_hash: accessTokenHash,
      customer_email: input.customer_email,
      billing_data: input.billing_data,
      answers: input.answers,
      status: input.status || "checkout_started",
      expires_at: expiresAt
    })
  });
  const row = rows?.[0];

  if (!row?.id) {
    throw new Error("Supabase case insert returned no id");
  }

  return {
    id: row.id as string,
    reference: row.reference as string,
    accessToken
  };
}

export async function updateCaseById(id: string, patch: Record<string, unknown>, env: Env = process.env) {
  await supabaseRequest(env, `passnotfall_cases?id=eq.${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({
      ...patch,
      updated_at: new Date().toISOString()
    })
  });
}

export async function updateCaseByToken(accessToken: string, patch: Record<string, unknown>, env: Env = process.env) {
  const accessTokenHash = hashAccessToken(accessToken);

  await supabaseRequest(env, `passnotfall_cases?access_token_hash=eq.${encodeURIComponent(accessTokenHash)}`, {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({
      ...patch,
      updated_at: new Date().toISOString()
    })
  });
}

export async function getCaseByToken(accessToken: string, env: Env = process.env) {
  const accessTokenHash = hashAccessToken(accessToken);
  const rows = await supabaseRequest(
    env,
    `passnotfall_cases?access_token_hash=eq.${encodeURIComponent(accessTokenHash)}&select=*`
  );

  return rows?.[0] || null;
}
