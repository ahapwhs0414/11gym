import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import { getVotingTargetWeekStart, isVotingOpen, toDateOnlyString } from "@/lib/duty-week";
import { runWeeklyAssignment } from "@/lib/assignment/run-weekly-assignment";

const closeSchema = z.object({
  weekStart: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  reason: z.string().trim().max(200).optional(),
});

/**
 * 명세서 §15: 정규 마감(금요일 21:00) 전에도 관리자가 투표를 조기 마감할 수 있게 한다.
 * 조기 마감과 동시에 §17의 절차(마감 → 확정 → 자동 배정 → 검증 → 확정 → 공개)를 즉시 실행한다.
 */
export async function POST(request: Request) {
  const session = await getSession();
  if (!session.userId || session.role !== "ADMIN") {
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const parsed = closeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "입력값이 올바르지 않습니다." }, { status: 400 });
  }

  const weekStart = parsed.data.weekStart
    ? new Date(`${parsed.data.weekStart}T00:00:00.000Z`)
    : getVotingTargetWeekStart();

  if (!isVotingOpen(weekStart)) {
    return NextResponse.json(
      { error: "이미 정규 마감 시각이 지난 주입니다. 필요 시 수동 배정을 이용해주세요." },
      { status: 409 }
    );
  }

  const existing = await prisma.votingClosure.findUnique({ where: { weekStart } });
  if (existing) {
    return NextResponse.json({ error: "이미 조기 마감된 주입니다." }, { status: 409 });
  }

  await prisma.votingClosure.create({
    data: { weekStart, closedBy: session.userId, reason: parsed.data.reason },
  });

  const result = await runWeeklyAssignment(weekStart);

  await writeAuditLog({
    actorId: session.userId,
    action: "VOTING_CLOSED_EARLY",
    targetType: "VotingClosure",
    targetId: toDateOnlyString(weekStart),
    afterData: { weekStart: toDateOnlyString(weekStart), reason: parsed.data.reason, result },
    reason: parsed.data.reason,
  });

  return NextResponse.json({ ok: true, result });
}
