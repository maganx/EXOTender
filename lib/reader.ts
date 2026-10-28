import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import { STD_DOCS } from "./domain";
import type { Lang } from "./i18n";

const STD_KEYS = STD_DOCS.map(([k, , en]) => `${k} (${en})`);

const Reading = z.object({
  summary: z.string().describe("Two or three sentences: what is being procured, by whom, and anything unusual about submission."),
  documents: z.array(
    z.object({
      label: z.string().describe("The document or attachment the bidder must submit, named as the tender names it."),
      std_key: z.string().describe(`The matching standard document key, one of: ${STD_KEYS.join(", ")}; or "none".`),
      section: z.string().describe("Where it goes: the bid form section, NeST attachment field or ITB clause, as written in the tender. Empty if not stated."),
      note: z.string().describe("Conditions that matter: validity, certification, format, who signs, amounts. Empty if none."),
      page: z.number().int().nullable().describe("Page of the tender document where the requirement is stated, if known."),
    }),
  ),
});
export type ReadItem = z.infer<typeof Reading>["documents"][number];
export type ReadResult = { summary: string; documents: ReadItem[]; inputTokens: number; outputTokens: number };

// About 400k tokens of text: well inside the model's context, and a bound on the cost of one read.
export const MAX_CHARS = 1_500_000;

const SYSTEM = `You read Tanzanian public procurement tender documents (NeST, PPRA standard bidding documents, RFQs) for a supplier preparing a bid.
List every document, certificate, form and attachment the bidder must submit with the bid, from the Instructions to Bidders, Bid Data Sheet, evaluation and qualification criteria, and bidding forms.
Include qualification evidence (registration, tax, licences, experience, financial statements, manufacturer authorisation), forms to fill and sign, bid security or declaration, price schedules, technical compliance sheets and samples or brochures.
Leave out documents only the procuring entity issues and post-award items (performance security, contract signing) unless they are required at bid time.
Merge duplicates. Keep each label short. Write label, section and note in {LANG}; keep official form names and clause numbers as they appear.`;

/** Ask Claude which documents a tender requires. `text` is the tender document text, page by page. */
export async function readTender(text: string, lang: Lang): Promise<ReadResult> {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const response = await client.beta.messages.parse({
    model: "claude-opus-5-5",
    max_tokens: 16000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: "medium", format: betaZodOutputFormat(Reading) },
    system: SYSTEM.replace("{LANG}", lang === "sw" ? "Swahili" : "English"),
    messages: [{ role: "user", content: `<tender_document>\n${text}\n</tender_document>` }],
  });
  if (response.stop_reason === "refusal") throw new Error("refusal");
  if (response.stop_reason === "max_tokens" || !response.parsed_output) throw new Error("incomplete");
  return {
    ...response.parsed_output,
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
  };
}
