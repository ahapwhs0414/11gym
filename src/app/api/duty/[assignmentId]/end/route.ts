import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { endDuty, DutyLogError } from "@/lib/duty-log";

const endSchema = z.object({ note: z.string().trim().max(1000).optional() });

export async function POST(
  request: Request,
  { params }: { params: Promise<{ assignmentId: string }> }
) {
  const session = await getSession();
  if (!session.userId || session.role !== "USER") {
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  }
  const { assignmentId } = await params;

  const body = await request.json().catch(() => ({}));
  const parsed = endSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "입력값이 올바르지 않습니다." }, { status: 400 });
  }

  try {
    const dutyLog = await endDuty(assignmentId, session.userId, parsed.data.note);
    return NextResponse.json({ ok: true, endedEarly: dutyLog.endedEarly });
  } catch (error) {
    if (error instanceof DutyLogError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    throw error;
  }
}
