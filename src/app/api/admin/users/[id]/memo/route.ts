import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";

const updateSchema = z.object({ memo: z.string().trim().max(2000) });

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

  const existing = await prisma.user.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "사용자를 찾을 수 없습니다." }, { status: 404 });
  }

  await prisma.user.update({ where: { id }, data: { adminMemo: parsed.data.memo || null } });

  await writeAuditLog({
    actorId: session.userId,
    action: "USER_MEMO_UPDATE",
    targetType: "User",
    targetId: id,
    beforeData: { adminMemo: existing.adminMemo },
    afterData: { adminMemo: parsed.data.memo },
  });

  return NextResponse.json({ ok: true });
}
