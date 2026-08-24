import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { isLoginLocked, recordLoginAttempt } from "@/lib/login-guard";

const loginSchema = z.object({
  name: z.string().min(1, "이름을 입력해주세요."),
  pin: z.string().regex(/^\d{4}$/, "PIN은 4자리 숫자여야 합니다."),
});

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = loginSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "입력값이 올바르지 않습니다." },
      { status: 400 }
    );
  }

  const { name, pin } = parsed.data;

  const user = await prisma.user.findFirst({
    where: { name, role: "USER" },
  });

  // 존재하지 않는 사용자와 PIN 불일치를 동일한 메시지로 처리해 계정 존재 여부가 드러나지 않게 합니다.
  if (!user || user.status !== "ACTIVE") {
    return NextResponse.json(
      { error: "이름 또는 PIN이 일치하지 않습니다." },
      { status: 401 }
    );
  }

  const locked = await isLoginLocked(user.id);
  if (locked) {
    return NextResponse.json(
      { error: "로그인 시도가 너무 많습니다. 5분 후 다시 시도해주세요." },
      { status: 429 }
    );
  }

  const valid = await bcrypt.compare(pin, user.pinHash);
  await recordLoginAttempt(user.id, valid);

  if (!valid) {
    return NextResponse.json(
      { error: "이름 또는 PIN이 일치하지 않습니다." },
      { status: 401 }
    );
  }

  const session = await getSession();
  session.userId = user.id;
  session.role = user.role;
  session.name = user.name;
  await session.save();

  return NextResponse.json({ ok: true });
}
