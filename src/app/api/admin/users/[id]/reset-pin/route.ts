import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";

const resetPinSchema = z.object({
  pin: z.string().regex(/^\d{4}$/, "PIN은 4자리 숫자여야 합니다."),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session.userId || session.role !== "ADMIN") {
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = resetPinSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "입력값이 올바르지 않습니다." },
      { status: 400 }
    );
  }

  const user = await prisma.user.findUnique({ where: { id } });
  if (!user || user.role !== "USER") {
    return NextResponse.json({ error: "사용자를 찾을 수 없습니다." }, { status: 404 });
  }

  const pinHash = await bcrypt.hash(parsed.data.pin, 10);
  await prisma.user.update({ where: { id }, data: { pinHash } });

  await writeAuditLog({
    actorId: session.userId,
    action: "USER_PIN_RESET",
    targetType: "User",
    targetId: id,
  });

  return NextResponse.json({ ok: true });
}
