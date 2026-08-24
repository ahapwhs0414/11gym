import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";

const createUserSchema = z.object({
  name: z.string().trim().min(1, "이름을 입력해주세요.").max(50),
  pin: z.string().regex(/^\d{4}$/, "PIN은 4자리 숫자여야 합니다."),
  gymPreference: z.enum(["GYM1", "GYM2", "ANY"]).default("ANY"),
});

export async function POST(request: Request) {
  const session = await getSession();
  if (!session.userId || session.role !== "ADMIN") {
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const parsed = createUserSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "입력값이 올바르지 않습니다." },
      { status: 400 }
    );
  }

  const { name, pin, gymPreference } = parsed.data;

  const existing = await prisma.user.findFirst({ where: { name, role: "USER" } });
  if (existing) {
    return NextResponse.json(
      { error: "이미 같은 이름의 사용자가 있습니다." },
      { status: 409 }
    );
  }

  const pinHash = await bcrypt.hash(pin, 10);
  const user = await prisma.user.create({
    data: { name, pinHash, role: "USER", gymPreference },
  });

  await writeAuditLog({
    actorId: session.userId,
    action: "USER_CREATE",
    targetType: "User",
    targetId: user.id,
    afterData: { name: user.name, gymPreference: user.gymPreference, status: user.status },
  });

  return NextResponse.json({ ok: true, id: user.id });
}
