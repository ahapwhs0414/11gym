import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "현재 비밀번호를 입력해주세요."),
  newPassword: z.string().min(8, "새 비밀번호는 8자 이상이어야 합니다."),
});

export async function POST(request: Request) {
  const session = await getSession();
  if (!session.userId || session.role !== "ADMIN") {
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const parsed = changePasswordSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "입력값이 올바르지 않습니다." },
      { status: 400 }
    );
  }

  const admin = await prisma.user.findUnique({ where: { id: session.userId } });
  if (!admin || admin.role !== "ADMIN") {
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  }

  const valid = await bcrypt.compare(parsed.data.currentPassword, admin.pinHash);
  if (!valid) {
    return NextResponse.json(
      { error: "현재 비밀번호가 일치하지 않습니다." },
      { status: 401 }
    );
  }

  const pinHash = await bcrypt.hash(parsed.data.newPassword, 10);
  await prisma.user.update({ where: { id: admin.id }, data: { pinHash } });

  await writeAuditLog({
    actorId: admin.id,
    action: "ADMIN_PASSWORD_CHANGE",
    targetType: "User",
    targetId: admin.id,
  });

  return NextResponse.json({ ok: true });
}
