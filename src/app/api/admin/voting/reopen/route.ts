import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import { notifyUsers } from "@/lib/notify";
import { getVotingTargetWeekStart, toDateOnlyString } from "@/lib/duty-week";
import { cancelWeeklyAssignment, AssignmentCancelError } from "@/lib/assignment/run-weekly-assignment";

const reopenSchema = z.object({
  weekStart: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
});

/**
 * 조기 마감을 취소해 다시 투표를 받을 수 있게 한다. 조기 마감으로 실행됐던 자동 배정도 함께
 * 취소한다(§15.1) — 이미 실제로 시작된 직감이 있으면 안전을 위해 취소를 거부한다.
 */
export async function POST(request: Request) {
  const session = await getSession();
  if (!session.userId || session.role !== "ADMIN") {
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const parsed = reopenSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "입력값이 올바르지 않습니다." }, { status: 400 });
  }

  const weekStart = parsed.data.weekStart
    ? new Date(`${parsed.data.weekStart}T00:00:00.000Z`)
    : getVotingTargetWeekStart();

  const existing = await prisma.votingClosure.findUnique({ where: { weekStart } });
  if (!existing) {
    return NextResponse.json({ error: "조기 마감된 주가 아닙니다." }, { status: 404 });
  }

  let result;
  try {
    result = await cancelWeeklyAssignment(weekStart);
  } catch (error) {
    if (error instanceof AssignmentCancelError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    throw error;
  }

  await prisma.votingClosure.delete({ where: { weekStart } });

  if (result.affectedUserIds.length > 0) {
    await notifyUsers(result.affectedUserIds, {
      type: "ASSIGNMENT_RESULT",
      title: "다음 주 직감 배정이 취소되었습니다.",
      content: `${toDateOnlyString(weekStart)} 주 투표가 재오픈되어 기존 배정이 취소되었습니다. 다시 투표해주세요.`,
    });
  }

  await writeAuditLog({
    actorId: session.userId,
    action: "VOTING_REOPENED",
    targetType: "VotingClosure",
    targetId: toDateOnlyString(weekStart),
    beforeData: { weekStart: toDateOnlyString(weekStart), reason: existing.reason },
    afterData: { cancelledAssignments: result.cancelledAssignments },
  });

  return NextResponse.json({ ok: true, cancelledAssignments: result.cancelledAssignments });
}
