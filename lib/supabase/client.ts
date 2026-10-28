import { createBrowserClient } from "@supabase/ssr";

/** Browser client for direct uploads to Storage; Row Level Security still applies. */
export function createClient() {
  return createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
}
