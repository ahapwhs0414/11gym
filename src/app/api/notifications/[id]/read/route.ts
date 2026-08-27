import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session.userId) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }
  const { id } = await params;

  const notification = await prisma.notification.findUnique({ where: { id } });
  if (!notification || notification.userId !== session.userId) {
    return NextResponse.json({ error: "알림을 찾을 수 없습니다." }, { status: 404 });
  }

  await prisma.notification.update({
    where: { id },
    data: { readAt: notification.readAt ?? new Date() },
  });

  return NextResponse.json({ ok: true });
}
