import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

const gymPreferenceSchema = z.object({
  gymPreference: z.enum(["GYM1", "GYM2", "ANY"]),
});

export async function POST(request: Request) {
  const session = await getSession();
  if (!session.userId || session.role !== "USER") {
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const parsed = gymPreferenceSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "입력값이 올바르지 않습니다." }, { status: 400 });
  }

  await prisma.user.update({
    where: { id: session.userId },
    data: { gymPreference: parsed.data.gymPreference },
  });

  return NextResponse.json({ ok: true });
}
