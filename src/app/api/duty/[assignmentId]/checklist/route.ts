import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { toggleChecklistItem, DutyLogError } from "@/lib/duty-log";

const bodySchema = z.object({
  checklistItemId: z.string().min(1),
  completed: z.boolean(),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ assignmentId: string }> }
) {
  const session = await getSession();
  if (!session.userId || session.role !== "USER") {
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  }
  const { assignmentId } = await params;

  const body = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "입력값이 올바르지 않습니다." }, { status: 400 });
  }

  try {
    await toggleChecklistItem(
      assignmentId,
      session.userId,
      parsed.data.checklistItemId,
      parsed.data.completed
    );
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof DutyLogError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    throw error;
  }
}
