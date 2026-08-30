import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";

const createSchema = z.object({
  name: z.string().trim().min(1, "이름을 입력해주세요.").max(100),
  required: z.boolean(),
  dayOfWeek: z.number().int().min(0).max(6).nullable(),
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

  const { name, required, dayOfWeek } = parsed.data;
  const count = await prisma.checklistItem.count({ where: { dayOfWeek } });

  const created = await prisma.checklistItem.create({
    data: { name, required, dayOfWeek, sortOrder: count },
  });

  await writeAuditLog({
    actorId: session.userId,
    action: "CHECKLIST_ITEM_CREATE",
    targetType: "ChecklistItem",
    targetId: created.id,
    afterData: { name, required, dayOfWeek },
  });

  return NextResponse.json({ ok: true, id: created.id });
}
