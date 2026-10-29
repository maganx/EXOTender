import { createServerClient } from "@supabase/ssr";
import { serverEnv } from "./env";

// Selcom checkout (https://developers.selcommobile.com). Every request is signed with HMAC-SHA256:
// Digest = base64(HMAC(secret, "timestamp=<ts>&k1=v1&k2=v2...")), the keys listed in Signed-Fields.

type Json = Record<string, string | number>;
export type SelcomReply = { resultcode?: string; result?: string; message?: string; reference?: string; data?: Record<string, unknown>[] };

const enc = new TextEncoder();
const b64 = (s: string) => btoa(String.fromCharCode(...enc.encode(s)));

function config() {
  const key = serverEnv("SELCOM_API_KEY");
  const secret = serverEnv("SELCOM_API_SECRET");
  const vendor = serverEnv("SELCOM_VENDOR");
  if (!key || !secret || !vendor) return null;
  return { key, secret, vendor, base: (serverEnv("SELCOM_BASE_URL") || "https://apigw.selcommobile.com").replace(/\/$/, "") };
}

export const selcomConfigured = () => config() !== null;

async function hmac(secret: string, data: string) {
  const k = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return new Uint8Array(await crypto.subtle.sign("HMAC", k, enc.encode(data)));
}

/** Selcom wants the local time with its offset; Tanzania is UTC+3 all year. */
function timestamp() {
  return new Date(Date.now() + 3 * 3600_000).toISOString().slice(0, 19) + "+03:00";
}

async function call(method: "GET" | "POST", path: string, data: Json): Promise<SelcomReply> {
  const c = config();
  if (!c) throw new Error("Selcom is not configured");
  const ts = timestamp();
  const keys = Object.keys(data);
  const signing = [`timestamp=${ts}`, ...keys.map((k) => `${k}=${data[k]}`)].join("&");
  const digest = btoa(String.fromCharCode(...(await hmac(c.secret, signing))));
  const qs = method === "GET" ? "?" + new URLSearchParams(Object.entries(data).map(([k, v]) => [k, String(v)])).toString() : "";
  const res = await fetch(c.base + path + qs, {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `SELCOM ${b64(c.key)}`,
      "Digest-Method": "HS256",
      Digest: digest,
      Timestamp: ts,
      "Signed-Fields": keys.join(","),
    },
    body: method === "POST" ? JSON.stringify(data) : undefined,
  });
  const text = await res.text();
  try {
    return JSON.parse(text) as SelcomReply;
  } catch {
    return { resultcode: String(res.status), result: "FAIL", message: text.slice(0, 200) };
  }
}

export const selcomOk = (r: SelcomReply) => r.resultcode === "000";

export async function createOrder(o: {
  orderId: string;
  amount: number;
  email: string;
  name: string;
  phone: string;
  site: string;
  remarks: string;
}) {
  const c = config()!;
  return call("POST", "/v1/checkout/create-order-minimal", {
    vendor: c.vendor,
    order_id: o.orderId,
    buyer_email: o.email,
    buyer_name: o.name,
    buyer_phone: o.phone,
    amount: o.amount,
    currency: "TZS",
    redirect_url: b64(`${o.site}/app/billing?order=${o.orderId}`),
    cancel_url: b64(`${o.site}/app/billing`),
    webhook: b64(`${o.site}/api/selcom/webhook`),
    buyer_remarks: o.remarks,
    merchant_remarks: o.remarks,
    no_of_items: 1,
    expiry: 60,
  });
}

/** Sends the mobile money PIN prompt to the customer's phone for an order. */
export function pushToPhone(orderId: string, phone: string) {
  return call("POST", "/v1/checkout/wallet-payment", { transid: `${orderId}P${Date.now() % 100000}`, order_id: orderId, msisdn: phone });
}

export function orderStatus(orderId: string) {
  return call("GET", "/v1/checkout/order-status", { order_id: orderId });
}

/** The key the server shows the database to confirm a payment; derived, so there is no extra secret to set. */
export async function gatewayKey() {
  const c = config();
  if (!c) return null;
  return [...(await hmac(c.secret, "tenda-desk-gateway"))].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function sha256Hex(s: string) {
  return [...new Uint8Array(await crypto.subtle.digest("SHA-256", enc.encode(s)))].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** A database client with no user session, for the webhook. */
export function anonClient() {
  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: { getAll: () => [], setAll: () => {} },
  });
}

const CLOSED = ["CANCELLED", "USERCANCELLED", "REJECTED", "FAILED", "EXPIRED"];

/**
 * Asks Selcom for the order's status and settles the payment row to match.
 * Never trusts the caller: only Selcom's own answer moves a payment.
 */
export async function settleOrder(orderId: string): Promise<"approved" | "pending" | "closed" | "error"> {
  const key = await gatewayKey();
  if (!key) return "error";
  const r = await orderStatus(orderId);
  const row = r.data?.[0] as { payment_status?: string; amount?: string | number; transid?: string } | undefined;
  if (!selcomOk(r) || !row) return "error";
  const status = String(row.payment_status ?? "").toUpperCase();
  const db = anonClient();
  if (status === "COMPLETED") {
    const { data, error } = await db.rpc("gateway_confirm_payment", {
      p_order: orderId,
      p_transid: String(row.transid ?? ""),
      p_amount: Number(row.amount),
      p_key: key,
    });
    if (error) {
      console.error("selcom confirm", error.message);
      return "error";
    }
    return data === "approved" ? "approved" : "error";
  }
  if (CLOSED.includes(status)) {
    await db.rpc("gateway_close_payment", { p_order: orderId, p_status: status, p_key: key });
    return "closed";
  }
  return "pending";
}

/** Tanzanian phone numbers in the 255XXXXXXXXX form Selcom expects. */
export function tzPhone(raw: string) {
  const d = raw.replace(/\D/g, "");
  const n = d.startsWith("255") ? d.slice(3) : d.startsWith("0") ? d.slice(1) : d;
  return /^[67]\d{8}$/.test(n) ? `255${n}` : null;
}
