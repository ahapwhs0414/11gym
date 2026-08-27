import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import { toDateOnlyString } from "@/lib/duty-week";

const deleteSchema = z.object({
  reason: z.string().trim().min(1, "삭제 사유를 입력해주세요.").max(200),
});

/**
 * 관리자가 잘못 생성됐거나 테스트로 만들어진 직감 기록을 완전히 삭제한다.
 * §20의 "이력은 삭제하지 않는다" 원칙에 대한 명시적 예외이며, 삭제 전 상태를 감사 로그에
 * 스냅샷으로 남겨 추적 가능성을 유지한다.
 */
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session.userId || session.role !== "ADMIN") {
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  }
  const { id } = await params;

  const body = await request.json().catch(() => null);
  const parsed = deleteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "입력값이 올바르지 않습니다." },
      { status: 400 }
    );
  }

  const assignment = await prisma.dutyAssignment.findUnique({
    where: { id },
    include: {
      dutySlot: true,
      gym: true,
      user: true,
      dutyLog: { include: { checklistResults: true } },
      history: true,
      exchangeRequestsFrom: true,
      exchangeRequestsTo: true,
    },
  });
  if (!assignment) {
    return NextResponse.json({ error: "기록을 찾을 수 없습니다." }, { status: 404 });
  }

  const snapshot = {
    date: toDateOnlyString(assignment.dutySlot.date),
    startTime: assignment.dutySlot.startTime,
    endTime: assignment.dutySlot.endTime,
    gym: assignment.gym.name,
    userId: assignment.userId,
    userName: assignment.user.name,
    assignedType: assignment.assignedType,
    dutyLogStatus: assignment.dutyLog?.status ?? null,
    startedAt: assignment.dutyLog?.startedAt ?? null,
    endedAt: assignment.dutyLog?.endedAt ?? null,
    deletedHistoryCount: assignment.history.length,
    deletedExchangeRequestCount:
      assignment.exchangeRequestsFrom.length + assignment.exchangeRequestsTo.length,
  };

  await prisma.$transaction(async (tx) => {
    if (assignment.dutyLog) {
      await tx.checklistLog.deleteMany({ where: { dutyLogId: assignment.dutyLog.id } });
      await tx.dutyLog.delete({ where: { id: assignment.dutyLog.id } });
    }
    await tx.assignmentHistory.deleteMany({ where: { assignmentId: id } });
    await tx.dutyExchangeRequest.deleteMany({
      where: { OR: [{ assignmentId: id }, { targetAssignmentId: id }] },
    });
    await tx.dutyAssignment.delete({ where: { id } });

    const remaining = await tx.dutyAssignment.count({
      where: { dutySlotId: assignment.dutySlotId },
    });
    await tx.dutySlot.update({
      where: { id: assignment.dutySlotId },
      data: { status: remaining >= 2 ? "COMPLETED" : remaining === 0 ? "OPEN" : "UNDERSTAFFED" },
    });
  });

  await writeAuditLog({
    actorId: session.userId,
    action: "ASSIGNMENT_DELETE",
    targetType: "DutyAssignment",
    targetId: id,
    beforeData: snapshot,
    reason: parsed.data.reason,
  });

  return NextResponse.json({ ok: true });
}
