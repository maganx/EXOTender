import { NextResponse } from "next/server";
import { settleOrder } from "@/lib/selcom";

// Selcom calls this when a checkout order changes. The call is not signed, so it only names the
// order: settleOrder asks Selcom itself for the status before anything is recorded.
export async function POST(request: Request) {
  let orderId = "";
  try {
    const body = (await request.json()) as { order_id?: unknown };
    orderId = typeof body.order_id === "string" ? body.order_id : "";
  } catch {
    // not JSON
  }
  if (!/^TD[A-Z0-9]{6,30}$/.test(orderId)) return NextResponse.json({ result: "FAIL", resultcode: "400" }, { status: 400 });
  const state = await settleOrder(orderId);
  return NextResponse.json({ result: "SUCCESS", resultcode: "000", state });
}
