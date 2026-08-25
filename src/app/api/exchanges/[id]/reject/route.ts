import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { rejectExchangeRequest, ExchangeError } from "@/lib/exchange";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session.userId || session.role !== "USER") {
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  }
  const { id } = await params;

  try {
    await rejectExchangeRequest(id, session.userId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof ExchangeError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    throw error;
  }
}
