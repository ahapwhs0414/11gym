import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { setLateGraceMinutes } from "@/lib/settings";
import { writeAuditLog } from "@/lib/audit";
import { getLateGraceMinutes } from "@/lib/settings";

const updateSchema = z.object({ lateGraceMinutes: z.number().int().min(0).max(60) });

export async function PATCH(request: Request) {
  const session = await getSession();
  if (!session.userId || session.role !== "ADMIN") {
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "입력값이 올바르지 않습니다." }, { status: 400 });
  }

  const before = await getLateGraceMinutes();
  await setLateGraceMinutes(parsed.data.lateGraceMinutes, session.userId);

  await writeAuditLog({
    actorId: session.userId,
    action: "SYSTEM_SETTING_UPDATE",
    targetType: "SystemSetting",
    targetId: "LATE_GRACE_MINUTES",
    beforeData: { lateGraceMinutes: before },
    afterData: { lateGraceMinutes: parsed.data.lateGraceMinutes },
  });

  return NextResponse.json({ ok: true });
}
