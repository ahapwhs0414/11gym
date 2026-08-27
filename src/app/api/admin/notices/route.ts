import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";

const createSchema = z.object({
  title: z.string().trim().min(1, "제목을 입력해주세요.").max(200),
  content: z.string().trim().min(1, "내용을 입력해주세요.").max(5000),
  isImportant: z.boolean().optional(),
});

export async function POST(request: Request) {
  const session = await getSession();
  if (!session.userId || session.role !== "ADMIN") {
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "입력값이 올바르지 않습니다." },
      { status: 400 }
    );
  }

  const notice = await prisma.notice.create({
    data: {
      title: parsed.data.title,
      content: parsed.data.content,
      isImportant: parsed.data.isImportant ?? false,
      createdBy: session.userId,
    },
  });

  await writeAuditLog({
    actorId: session.userId,
    action: "NOTICE_CREATE",
    targetType: "Notice",
    targetId: notice.id,
    afterData: { title: notice.title, isImportant: notice.isImportant },
  });

  return NextResponse.json({ ok: true, id: notice.id });
}
