import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import { getAssignmentTargetWeekStart } from "@/lib/duty-week";
import { runWeeklyAssignment } from "@/lib/assignment/run-weekly-assignment";

const runSchema = z.object({
  // YYYY-MM-DD (해당 주의 월요일). 생략하면 자동으로 "마감이 방금 지난 주"를 사용한다.
  weekStart: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
});

// 명세서 §17: 시스템 오류로 자동 배정이 실행되지 않았을 때 관리자가 수동으로 실행하는 예외 경로.
export async function POST(request: Request) {
  const session = await getSession();
  if (!session.userId || session.role !== "ADMIN") {
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const parsed = runSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "입력값이 올바르지 않습니다." }, { status: 400 });
  }

  const weekStart = parsed.data.weekStart
    ? new Date(`${parsed.data.weekStart}T00:00:00.000Z`)
    : getAssignmentTargetWeekStart();

  const result = await runWeeklyAssignment(weekStart);

  await writeAuditLog({
    actorId: session.userId,
    action: "ASSIGNMENT_MANUAL_RUN",
    targetType: "DutySlot",
    targetId: result.weekStart,
    afterData: result,
  });

  return NextResponse.json({ ok: true, result });
}
