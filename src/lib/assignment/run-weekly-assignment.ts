import "server-only";
import { prisma } from "@/lib/prisma";
import { ensureDutySlotsForWeek } from "@/lib/duty-week";
import {
  assignWeek,
  type GymKey,
  type SlotInput,
  type UserInput,
} from "@/lib/assignment/fairness-engine";

const GYM_NAMES: Record<GymKey, string> = { GYM1: "힘레븐1", GYM2: "힘레븐2" };

function toDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export interface WeeklyAssignmentResult {
  weekStart: string;
  alreadyAssigned: boolean;
  createdAssignments: number;
  understaffedSlots: { slotId: string; date: string; startTime: string; gym: GymKey }[];
}

/**
 * 명세서 §17/§19-31의 자동 배정을 실행한다.
 * 이미 배정이 존재하는 슬롯은 건너뛰므로 재실행해도 안전하다(idempotent).
 */
export async function runWeeklyAssignment(weekStart: Date): Promise<WeeklyAssignmentResult> {
  const slots = await ensureDutySlotsForWeek(weekStart);
  const slotIds = slots.map((s) => s.id);

  const existingAssignments = await prisma.dutyAssignment.findMany({
    where: { dutySlotId: { in: slotIds } },
  });

  const gyms = await prisma.gym.findMany();
  const gymIdByKey: Record<GymKey, string | undefined> = {
    GYM1: gyms.find((g) => g.name === GYM_NAMES.GYM1)?.id,
    GYM2: gyms.find((g) => g.name === GYM_NAMES.GYM2)?.id,
  };
  if (!gymIdByKey.GYM1 || !gymIdByKey.GYM2) {
    throw new Error("힘레븐1/힘레븐2 헬스장 데이터가 없습니다. 시드를 먼저 실행하세요.");
  }
  const gymKeyById: Record<string, GymKey> = {
    [gymIdByKey.GYM1]: "GYM1",
    [gymIdByKey.GYM2]: "GYM2",
  };

  const prefilledGymsBySlot = new Map<string, GymKey[]>();
  for (const a of existingAssignments) {
    const arr = prefilledGymsBySlot.get(a.dutySlotId) ?? [];
    arr.push(gymKeyById[a.gymId]);
    prefilledGymsBySlot.set(a.dutySlotId, arr);
  }

  const pendingSlots = slots.filter(
    (slot) => (prefilledGymsBySlot.get(slot.id)?.length ?? 0) < 2
  );
  if (pendingSlots.length === 0) {
    return {
      weekStart: toDateOnly(weekStart),
      alreadyAssigned: true,
      createdAssignments: 0,
      understaffedSlots: [],
    };
  }

  const activeUsers = await prisma.user.findMany({
    where: { role: "USER", status: "ACTIVE" },
  });

  const availabilityRows = await prisma.availability.findMany({
    where: { dutySlotId: { in: pendingSlots.map((s) => s.id) }, available: true },
  });
  const candidatesBySlot = new Map<string, string[]>();
  for (const row of availabilityRows) {
    const arr = candidatesBySlot.get(row.dutySlotId) ?? [];
    arr.push(row.userId);
    candidatesBySlot.set(row.dutySlotId, arr);
  }

  const availableCountByUser = new Map<string, number>();
  for (const row of availabilityRows) {
    availableCountByUser.set(row.userId, (availableCountByUser.get(row.userId) ?? 0) + 1);
  }

  // 이미 채워진 슬롯의 기존 배정자는 같은 날짜 중복 배정 방지를 위해 후보 풀에서 제외해야 하므로,
  // 이번 주 전체(이미 채워진 슬롯 포함)의 기존 배정 날짜를 파악해둔다.
  const assignedDatesByUser = new Map<string, Set<string>>();
  for (const a of existingAssignments) {
    const slot = slots.find((s) => s.id === a.dutySlotId);
    if (!slot) continue;
    const set = assignedDatesByUser.get(a.userId) ?? new Set<string>();
    set.add(toDateOnly(slot.date));
    assignedDatesByUser.set(a.userId, set);
  }

  const historicalAssignments = await prisma.dutyAssignment.findMany({
    select: { userId: true, gymId: true, dutySlot: { select: { date: true } } },
  });
  const cumulativeCount = new Map<string, number>();
  const cumulativeGym1 = new Map<string, number>();
  const cumulativeGym2 = new Map<string, number>();
  const lastAssignedDate = new Map<string, string>();
  for (const a of historicalAssignments) {
    cumulativeCount.set(a.userId, (cumulativeCount.get(a.userId) ?? 0) + 1);
    if (a.gymId === gymIdByKey.GYM1) {
      cumulativeGym1.set(a.userId, (cumulativeGym1.get(a.userId) ?? 0) + 1);
    } else if (a.gymId === gymIdByKey.GYM2) {
      cumulativeGym2.set(a.userId, (cumulativeGym2.get(a.userId) ?? 0) + 1);
    }
    const dateStr = toDateOnly(a.dutySlot.date);
    const prev = lastAssignedDate.get(a.userId);
    if (!prev || dateStr > prev) lastAssignedDate.set(a.userId, dateStr);
  }

  const userInputs: UserInput[] = activeUsers.map((u) => ({
    id: u.id,
    gymPreference: u.gymPreference,
    cumulativeCount: cumulativeCount.get(u.id) ?? 0,
    cumulativeGym1Count: cumulativeGym1.get(u.id) ?? 0,
    cumulativeGym2Count: cumulativeGym2.get(u.id) ?? 0,
    lastAssignedDate: lastAssignedDate.get(u.id) ?? null,
    availableSlotCountThisWeek: availableCountByUser.get(u.id) ?? 0,
  }));

  const slotInputs: SlotInput[] = pendingSlots.map((s) => ({
    id: s.id,
    date: toDateOnly(s.date),
    sortKey: `${toDateOnly(s.date)}-${s.startTime}`,
    prefilledGyms: prefilledGymsBySlot.get(s.id) ?? [],
  }));

  // 이미 다른 슬롯에 배정된 날짜를 가진 사용자를 이번 배정 대상 후보에서 제외한다.
  const filteredCandidates = new Map<string, string[]>();
  for (const slot of pendingSlots) {
    const dateStr = toDateOnly(slot.date);
    const ids = (candidatesBySlot.get(slot.id) ?? []).filter((userId) => {
      const active = activeUsers.some((u) => u.id === userId);
      if (!active) return false;
      return !assignedDatesByUser.get(userId)?.has(dateStr);
    });
    filteredCandidates.set(slot.id, ids);
  }

  const plan = assignWeek({
    slots: slotInputs,
    users: userInputs,
    slotCandidates: filteredCandidates,
  });

  await prisma.$transaction(async (tx) => {
    for (const entry of plan.assignments) {
      await tx.dutyAssignment.create({
        data: {
          dutySlotId: entry.slotId,
          userId: entry.userId,
          gymId: gymIdByKey[entry.gym]!,
          assignedType: "AUTO",
        },
      });
    }

    for (const slot of pendingSlots) {
      const filledCount =
        plan.assignments.filter((a) => a.slotId === slot.id).length +
        existingAssignments.filter((a) => a.dutySlotId === slot.id).length;
      await tx.dutySlot.update({
        where: { id: slot.id },
        data: { status: filledCount >= 2 ? "COMPLETED" : "UNDERSTAFFED" },
      });
    }
  });

  const understaffedSlots = plan.understaffed.map((u) => {
    const slot = pendingSlots.find((s) => s.id === u.slotId)!;
    return {
      slotId: u.slotId,
      date: toDateOnly(slot.date),
      startTime: slot.startTime,
      gym: u.gym,
    };
  });

  return {
    weekStart: toDateOnly(weekStart),
    alreadyAssigned: false,
    createdAssignments: plan.assignments.length,
    understaffedSlots,
  };
}
