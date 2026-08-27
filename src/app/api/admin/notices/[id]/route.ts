import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";

const updateSchema = z.object({
  isImportant: z.boolean(),
});

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session.userId || session.role !== "ADMIN") {
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  }
  const { id } = await params;

  const body = await request.json().catch(() => null);
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "입력값이 올바르지 않습니다." }, { status: 400 });
  }

  const existing = await prisma.notice.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "공지를 찾을 수 없습니다." }, { status: 404 });
  }

  await prisma.notice.update({ where: { id }, data: { isImportant: parsed.data.isImportant } });

  await writeAuditLog({
    actorId: session.userId,
    action: "NOTICE_UPDATE",
    targetType: "Notice",
    targetId: id,
    beforeData: { isImportant: existing.isImportant },
    afterData: { isImportant: parsed.data.isImportant },
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session.userId || session.role !== "ADMIN") {
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  }
  const { id } = await params;

  const existing = await prisma.notice.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "공지를 찾을 수 없습니다." }, { status: 404 });
  }

  await prisma.notice.delete({ where: { id } });

  await writeAuditLog({
    actorId: session.userId,
    action: "NOTICE_DELETE",
    targetType: "Notice",
    targetId: id,
    beforeData: { title: existing.title, content: existing.content },
  });

  return NextResponse.json({ ok: true });
}
