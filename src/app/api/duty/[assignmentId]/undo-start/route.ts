import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { undoDutyStart, DutyLogError } from "@/lib/duty-log";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ assignmentId: string }> }
) {
  const session = await getSession();
  if (!session.userId || session.role !== "USER") {
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  }
  const { assignmentId } = await params;

  try {
    await undoDutyStart(assignmentId, session.userId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof DutyLogError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    throw error;
  }
}
