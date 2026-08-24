import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { isLoginLocked, recordLoginAttempt } from "@/lib/login-guard";

const adminLoginSchema = z.object({
  name: z.string().min(1, "관리자 아이디를 입력해주세요."),
  password: z.string().min(4, "비밀번호를 입력해주세요."),
});

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = adminLoginSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "입력값이 올바르지 않습니다." },
      { status: 400 }
    );
  }

  const { name, password } = parsed.data;

  const admin = await prisma.user.findFirst({
    where: { name, role: "ADMIN" },
  });

  if (!admin || admin.status !== "ACTIVE") {
    return NextResponse.json(
      { error: "아이디 또는 비밀번호가 일치하지 않습니다." },
      { status: 401 }
    );
  }

  const locked = await isLoginLocked(admin.id);
  if (locked) {
    return NextResponse.json(
      { error: "로그인 시도가 너무 많습니다. 5분 후 다시 시도해주세요." },
      { status: 429 }
    );
  }

  const valid = await bcrypt.compare(password, admin.pinHash);
  await recordLoginAttempt(admin.id, valid);

  if (!valid) {
    return NextResponse.json(
      { error: "아이디 또는 비밀번호가 일치하지 않습니다." },
      { status: 401 }
    );
  }

  const session = await getSession();
  session.userId = admin.id;
  session.role = admin.role;
  session.name = admin.name;
  await session.save();

  return NextResponse.json({ ok: true });
}
