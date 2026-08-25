import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session.userId || session.role !== "ADMIN") {
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  }
  const { id } = await params;

  const existing = await prisma.specialScheduleDay.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "찾을 수 없습니다." }, { status: 404 });
  }

  await prisma.specialScheduleDay.delete({ where: { id } });

  await writeAuditLog({
    actorId: session.userId,
    action: "SPECIAL_SCHEDULE_DAY_DELETE",
    targetType: "SpecialScheduleDay",
    targetId: id,
    beforeData: { date: existing.date.toISOString().slice(0, 10), reason: existing.reason },
  });

  return NextResponse.json({ ok: true });
}
