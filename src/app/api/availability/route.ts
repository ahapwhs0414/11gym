import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { ensureDutySlotsForWeek, getVotingTargetWeekStart, isVotingOpen } from "@/lib/duty-week";

const voteSchema = z.object({
  allUnavailable: z.boolean(),
  slots: z.array(
    z.object({
      slotId: z.string().min(1),
      available: z.boolean(),
    })
  ),
});

export async function POST(request: Request) {
  const session = await getSession();
  if (!session.userId || session.role !== "USER") {
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const parsed = voteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "입력값이 올바르지 않습니다." },
      { status: 400 }
    );
  }

  const weekStart = getVotingTargetWeekStart();
  if (!isVotingOpen(weekStart)) {
    return NextResponse.json({ error: "이번 주 투표는 마감되었습니다." }, { status: 409 });
  }

  const weekSlots = await ensureDutySlotsForWeek(weekStart);
  const weekSlotIds = new Set(weekSlots.map((slot) => slot.id));

  const { allUnavailable, slots } = parsed.data;

  if (slots.some((slot) => !weekSlotIds.has(slot.slotId))) {
    return NextResponse.json(
      { error: "이번 주에 속하지 않는 슬롯이 포함되어 있습니다." },
      { status: 400 }
    );
  }

  await prisma.$transaction(
    weekSlots.map((slot) => {
      const submitted = slots.find((s) => s.slotId === slot.id);
      const available = allUnavailable ? false : submitted?.available ?? false;
      return prisma.availability.upsert({
        where: { userId_dutySlotId: { userId: session.userId!, dutySlotId: slot.id } },
        create: { userId: session.userId!, dutySlotId: slot.id, available },
        update: { available },
      });
    })
  );

  return NextResponse.json({ ok: true });
}
