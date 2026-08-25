import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { createExchangeRequest, ExchangeError } from "@/lib/exchange";

const createSchema = z.object({
  assignmentId: z.string().min(1),
  replacementUserId: z.string().min(1),
  exchangeType: z.enum(["ONE_WAY", "TWO_WAY"]),
  targetAssignmentId: z.string().min(1).optional(),
  reason: z.string().trim().max(200).optional(),
});

export async function POST(request: Request) {
  const session = await getSession();
  if (!session.userId || session.role !== "USER") {
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "입력값이 올바르지 않습니다." },
      { status: 400 }
    );
  }

  try {
    const result = await createExchangeRequest({ requesterId: session.userId, ...parsed.data });
    return NextResponse.json({ ok: true, id: result.id });
  } catch (error) {
    if (error instanceof ExchangeError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    throw error;
  }
}
