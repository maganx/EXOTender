import { getCloudflareContext } from "@opennextjs/cloudflare";

/** A server-only setting: the Worker's variables and secrets, falling back to process.env (local dev). */
export function serverEnv(name: string): string | undefined {
  try {
    const v = (getCloudflareContext().env as unknown as Record<string, unknown>)[name];
    if (typeof v === "string" && v) return v;
  } catch {
    // not running inside the Worker
  }
  return process.env[name] || undefined;
}
