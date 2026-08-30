import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";

const updateSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  required: z.boolean().optional(),
  active: z.boolean().optional(),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session.userId || session.role !== "ADMIN") {
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  }
  const { id } = await params;

  const body = await request.json().catch(() => null);
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "입력값이 올바르지 않습니다." },
      { status: 400 }
    );
  }

  const existing = await prisma.checklistItem.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "찾을 수 없습니다." }, { status: 404 });
  }

  const updated = await prisma.checklistItem.update({
    where: { id },
    data: parsed.data,
  });

  await writeAuditLog({
    actorId: session.userId,
    action: "CHECKLIST_ITEM_UPDATE",
    targetType: "ChecklistItem",
    targetId: id,
    beforeData: { name: existing.name, required: existing.required, active: existing.active },
    afterData: { name: updated.name, required: updated.required, active: updated.active },
  });

  return NextResponse.json({ ok: true });
}

/** 이미 이력이 쌓인 체크리스트 항목은 완전히 삭제하지 않고 비활성화한다 (§20 이력 보존 원칙). */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session.userId || session.role !== "ADMIN") {
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  }
  const { id } = await params;

  const existing = await prisma.checklistItem.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "찾을 수 없습니다." }, { status: 404 });
  }

  await prisma.checklistItem.update({ where: { id }, data: { active: false } });

  await writeAuditLog({
    actorId: session.userId,
    action: "CHECKLIST_ITEM_DEACTIVATE",
    targetType: "ChecklistItem",
    targetId: id,
    beforeData: { name: existing.name, active: existing.active },
    afterData: { active: false },
  });

  return NextResponse.json({ ok: true });
}
