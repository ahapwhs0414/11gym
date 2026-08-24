import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

const changePinSchema = z.object({
  currentPin: z.string().regex(/^\d{4}$/, "현재 PIN은 4자리 숫자여야 합니다."),
  newPin: z.string().regex(/^\d{4}$/, "새 PIN은 4자리 숫자여야 합니다."),
});

export async function POST(request: Request) {
  const session = await getSession();
  if (!session.userId || session.role !== "USER") {
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const parsed = changePinSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "입력값이 올바르지 않습니다." },
      { status: 400 }
    );
  }

  const user = await prisma.user.findUnique({ where: { id: session.userId } });
  if (!user || user.role !== "USER") {
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  }

  const valid = await bcrypt.compare(parsed.data.currentPin, user.pinHash);
  if (!valid) {
    return NextResponse.json({ error: "현재 PIN이 일치하지 않습니다." }, { status: 401 });
  }

  const pinHash = await bcrypt.hash(parsed.data.newPin, 10);
  await prisma.user.update({ where: { id: user.id }, data: { pinHash } });

  return NextResponse.json({ ok: true });
}
