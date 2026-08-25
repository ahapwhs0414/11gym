import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import { toDateOnlyString } from "@/lib/duty-week";

const createSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "날짜 형식이 올바르지 않습니다."),
  reason: z.string().trim().max(200).optional(),
});

export async function POST(request: Request) {
  const session = await getSession();
  if (!session.userId || session.role !== "ADMIN") {
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "입력값이 올바르지 않습니다." },
      { status: 400 }
    );
  }

  const date = new Date(`${parsed.data.date}T00:00:00.000Z`);
  const today = toDateOnlyString(new Date());
  if (parsed.data.date < today) {
    return NextResponse.json({ error: "지나간 날짜는 지정할 수 없습니다." }, { status: 400 });
  }

  const existing = await prisma.specialScheduleDay.findUnique({ where: { date } });
  if (existing) {
    return NextResponse.json({ error: "이미 지정된 날짜입니다." }, { status: 409 });
  }

  const created = await prisma.specialScheduleDay.create({
    data: { date, reason: parsed.data.reason, createdBy: session.userId },
  });

  await writeAuditLog({
    actorId: session.userId,
    action: "SPECIAL_SCHEDULE_DAY_CREATE",
    targetType: "SpecialScheduleDay",
    targetId: created.id,
    afterData: { date: parsed.data.date, reason: parsed.data.reason },
  });

  return NextResponse.json({ ok: true, id: created.id });
}
