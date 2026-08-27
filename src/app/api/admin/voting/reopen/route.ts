import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import { getVotingTargetWeekStart, toDateOnlyString } from "@/lib/duty-week";

const reopenSchema = z.object({
  weekStart: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
});

/**
 * 조기 마감을 취소해 다시 투표를 받을 수 있게 한다. 이미 실행된 자동 배정 결과는 건드리지
 * 않으며(§17 idempotent), 이후 추가 투표를 반영해 미배정 슬롯을 채우려면 배정을 다시 실행한다.
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

  await prisma.votingClosure.delete({ where: { weekStart } });

  await writeAuditLog({
    actorId: session.userId,
    action: "VOTING_REOPENED",
    targetType: "VotingClosure",
    targetId: toDateOnlyString(weekStart),
    beforeData: { weekStart: toDateOnlyString(weekStart), reason: existing.reason },
  });

  return NextResponse.json({ ok: true });
}
