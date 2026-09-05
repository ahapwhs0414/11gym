import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit";

const assignmentSchema = z.object({
  dutySlotId: z.string().min(1),
  userId: z.string().min(1),
  gymId: z.string().min(1),
});

export async function POST(request: Request) {
  const session = await getSession();
  if (!session.userId || session.role !== "ADMIN") {
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const parsed = assignmentSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "입력값이 올바르지 않습니다." }, { status: 400 });
  }

  const { dutySlotId, userId, gymId } = parsed.data;

  try {
    const result = await prisma.$transaction(async (tx) => {
      const [slot, user, gym] = await Promise.all([
        tx.dutySlot.findUnique({
          where: { id: dutySlotId },
          include: { assignments: { include: { user: true, gym: true } } },
        }),
        tx.user.findUnique({ where: { id: userId } }),
        tx.gym.findUnique({ where: { id: gymId } }),
      ]);

      if (!slot) throw new Error("DUTY_SLOT_NOT_FOUND");
      if (!user || user.status !== "ACTIVE") throw new Error("USER_NOT_ACTIVE");
      if (!gym || gym.status !== "ACTIVE") throw new Error("GYM_NOT_ACTIVE");

      const existingGymAssignment = slot.assignments.find((a) => a.gymId === gymId);
      if (existingGymAssignment) throw new Error("GYM_ALREADY_ASSIGNED");

      const duplicateUserAssignment = slot.assignments.find((a) => a.userId === userId);
      if (duplicateUserAssignment) throw new Error("USER_ALREADY_ASSIGNED");

      const assignment = await tx.dutyAssignment.create({
        data: {
          dutySlotId,
          userId,
          gymId,
          assignedType: "ADMIN",
        },
        include: { user: true, gym: true },
      });

      const assignmentCount = slot.assignments.length + 1;
      const status = assignmentCount >= 2 ? "COMPLETED" : "UNDERSTAFFED";

      await tx.dutySlot.update({
        where: { id: dutySlotId },
        data: { status },
      });

      return { assignment, status };
    });

    await writeAuditLog({
      actorId: session.userId,
      action: "ASSIGNMENT_ADMIN_CREATE",
      targetType: "DutyAssignment",
      targetId: result.assignment.id,
      afterData: {
        dutySlotId,
        userId,
        gymId,
        assignedType: "ADMIN",
      },
    });

    return NextResponse.json({ ok: true, assignment: result.assignment, status: result.status });
  } catch (error) {
    const errorCode = error instanceof Error ? error.message : "UNKNOWN";
    const messages: Record<string, string> = {
      DUTY_SLOT_NOT_FOUND: "직감 시간대를 찾을 수 없습니다.",
      USER_NOT_ACTIVE: "선택한 사용자를 배정할 수 없습니다.",
      GYM_NOT_ACTIVE: "선택한 헬스장을 찾을 수 없습니다.",
      GYM_ALREADY_ASSIGNED: "해당 헬스장에는 이미 직감자가 배정되어 있습니다.",
      USER_ALREADY_ASSIGNED: "같은 시간대에 이미 배정된 사용자입니다.",
    };

    return NextResponse.json(
      { error: messages[errorCode] ?? "직감자 배정 중 오류가 발생했습니다." },
      { status: messages[errorCode] ? 400 : 500 }
    );
  }
}
