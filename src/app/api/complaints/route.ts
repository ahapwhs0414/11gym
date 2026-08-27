import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

const createSchema = z.object({
  title: z.string().trim().min(1, "제목을 입력해주세요.").max(200),
  content: z.string().trim().min(1, "내용을 입력해주세요.").max(5000),
  isAnonymous: z.boolean().optional(),
});

export async function POST(request: Request) {
  const session = await getSession();
  if (!session.userId || session.role !== "USER") {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "입력값이 올바르지 않습니다." },
      { status: 400 }
    );
  }

  const complaint = await prisma.complaint.create({
    data: {
      userId: session.userId,
      title: parsed.data.title,
      content: parsed.data.content,
      isAnonymous: parsed.data.isAnonymous ?? false,
    },
  });

  return NextResponse.json({ ok: true, id: complaint.id });
}
