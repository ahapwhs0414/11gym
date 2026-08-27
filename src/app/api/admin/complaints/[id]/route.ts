import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";

const updateSchema = z.object({
  status: z.enum(["RECEIVED", "IN_REVIEW", "RESOLVED"]).optional(),
  adminReply: z.string().trim().max(5000).optional(),
});

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session.userId || session.role !== "ADMIN") {
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  }
  const { id } = await params;

  const body = await request.json().catch(() => null);
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "입력값이 올바르지 않습니다." }, { status: 400 });
  }

  const existing = await prisma.complaint.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "의견을 찾을 수 없습니다." }, { status: 404 });
  }

  const updated = await prisma.complaint.update({
    where: { id },
    data: {
      status: parsed.data.status,
      adminReply: parsed.data.adminReply,
    },
  });

  await writeAuditLog({
    actorId: session.userId,
    action: "COMPLAINT_UPDATE",
    targetType: "Complaint",
    targetId: id,
    beforeData: { status: existing.status, adminReply: existing.adminReply },
    afterData: { status: updated.status, adminReply: updated.adminReply },
  });

  return NextResponse.json({ ok: true });
}
