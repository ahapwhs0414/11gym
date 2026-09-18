import "server-only";
import { prisma } from "@/lib/prisma";
import { addDays, ensureDutySlotsForWeek } from "@/lib/duty-week";
import { notifyUsers } from "@/lib/notify";
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

export class AssignmentCancelError extends Error {}

export interface WeeklyAssignmentResult {
  weekStart: string;
  alreadyAssigned: boolean;
  createdAssignments: number;
  understaffedSlots: { slotId: string; date: string; startTime: string; gym: GymKey }[];
  fairness: {
    maximum: number;
    minimum: number;
    spread: number;
    sumSquares: number;
    optimal: boolean;
  } | null;
}

/**
 * 명세서 §17/§19-31의 자동 배정을 실행한다.
 * 이미 배정이 존재하는 슬롯은 건너뛰므로 재실행해도 안전하다(idempotent).
 */
export async function runWeeklyAssignment(weekStart: Date): Promise<WeeklyAssignmentResult> {
  const slots = await ensureDutySlotsForWeek(weekStart);
  const slotIds = slots.map((s) => s.id);

  const [existingAssignments, gyms] = await Promise.all([
    prisma.dutyAssignment.findMany({ where: { dutySlotId: { in: slotIds } } }),
    prisma.gym.findMany(),
  ]);
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
      fairness: null,
    };
  }

  // 자동 배정은 과거 직감 이력을 사용하지 않는다. 이번 주 전체 투표와 이미 존재하는
  // 이번 주 배정만 사용한다. pending 슬롯만 조회하면 재실행 시 가능 타임 수가 달라질 수 있다.
  const [activeUsers, availabilityRows] = await Promise.all([
    prisma.user.findMany({ where: { role: "USER", status: "ACTIVE" } }),
    prisma.availability.findMany({
      where: { dutySlotId: { in: slotIds }, available: true },
    }),
  ]);
  const candidatesBySlot = new Map<string, string[]>();
  const preferredCandidatesBySlot = new Map<string, string[]>();
  for (const row of availabilityRows) {
    const arr = candidatesBySlot.get(row.dutySlotId) ?? [];
    arr.push(row.userId);
    candidatesBySlot.set(row.dutySlotId, arr);
    if (row.preferred) {
      const preferred = preferredCandidatesBySlot.get(row.dutySlotId) ?? [];
      preferred.push(row.userId);
      preferredCandidatesBySlot.set(row.dutySlotId, preferred);
    }
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

  const userInputs: UserInput[] = activeUsers.map((u) => ({
    id: u.id,
    gymPreference: u.gymPreference,
    availableSlotCountThisWeek: availableCountByUser.get(u.id) ?? 0,
    initialAssignmentCount: existingAssignments.filter((a) => a.userId === u.id).length,
    initiallyAssignedDates: [...(assignedDatesByUser.get(u.id) ?? new Set<string>())],
  }));

  const slotInputs: SlotInput[] = pendingSlots.map((s) => ({
    id: s.id,
    date: toDateOnly(s.date),
    sortKey: `${toDateOnly(s.date)}-${s.startTime}`,
    prefilledGyms: prefilledGymsBySlot.get(s.id) ?? [],
  }));

  // 이미 다른 슬롯에 배정된 날짜를 가진 사용자를 이번 배정 대상 후보에서 제외한다.
  const filteredCandidates = new Map<string, string[]>();
  const filteredPreferredCandidates = new Map<string, string[]>();
  for (const slot of pendingSlots) {
    const dateStr = toDateOnly(slot.date);
    const ids = (candidatesBySlot.get(slot.id) ?? []).filter((userId) => {
      const active = activeUsers.some((u) => u.id === userId);
      if (!active) return false;
      return !assignedDatesByUser.get(userId)?.has(dateStr);
    });
    filteredCandidates.set(slot.id, ids);
    const preferredIds = (preferredCandidatesBySlot.get(slot.id) ?? []).filter((userId) =>
      ids.includes(userId)
    );
    filteredPreferredCandidates.set(slot.id, preferredIds);
  }

  const seed = JSON.stringify({
    weekStart: toDateOnly(weekStart),
    users: [...activeUsers]
      .sort((a, b) => a.id.localeCompare(b.id))
      .map((u) => [u.id, u.gymPreference]),
    votes: [...availabilityRows]
      .sort((a, b) =>
        `${a.dutySlotId}:${a.userId}`.localeCompare(`${b.dutySlotId}:${b.userId}`)
      )
      .map((row) => [row.dutySlotId, row.userId, row.preferred]),
  });

  const plan = assignWeek({
    slots: slotInputs,
    users: userInputs,
    slotCandidates: filteredCandidates,
    preferredSlotCandidates: filteredPreferredCandidates,
    seed,
  });

  await prisma.$transaction(async (tx) => {
    if (plan.assignments.length > 0) {
      await tx.dutyAssignment.createMany({
        data: plan.assignments.map((entry) => ({
          dutySlotId: entry.slotId,
          userId: entry.userId,
          gymId: gymIdByKey[entry.gym]!,
          assignedType: "AUTO",
        })),
      });
    }

    // 슬롯마다 update()를 왕복 호출하는 대신, 상태별로 묶어서 updateMany 두 번으로 끝낸다.
    const completedSlotIds: string[] = [];
    const understaffedSlotIds: string[] = [];
    for (const slot of pendingSlots) {
      const filledCount =
        plan.assignments.filter((a) => a.slotId === slot.id).length +
        existingAssignments.filter((a) => a.dutySlotId === slot.id).length;
      (filledCount >= 2 ? completedSlotIds : understaffedSlotIds).push(slot.id);
    }
    if (completedSlotIds.length > 0) {
      await tx.dutySlot.updateMany({
        where: { id: { in: completedSlotIds } },
        data: { status: "COMPLETED" },
      });
    }
    if (understaffedSlotIds.length > 0) {
      await tx.dutySlot.updateMany({
        where: { id: { in: understaffedSlotIds } },
        data: { status: "UNDERSTAFFED" },
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

  // §18/§58: 배정이 확정되면 그 주에 배정받은 모든 사용자에게 알림을 보낸다.
  const notifiedUserIds = Array.from(new Set(plan.assignments.map((a) => a.userId)));
  await notifyUsers(notifiedUserIds, {
    type: "ASSIGNMENT_RESULT",
    title: "다음 주 직감 일정이 확정되었습니다.",
    content: `${toDateOnly(weekStart)} 주 직감 배정 결과를 확인해주세요.`,
  });

  return {
    weekStart: toDateOnly(weekStart),
    alreadyAssigned: false,
    createdAssignments: plan.assignments.length,
    understaffedSlots,
    fairness: {
      maximum: plan.fairness.maximum,
      minimum: plan.fairness.minimum,
      spread: plan.fairness.spread,
      sumSquares: plan.fairness.sumSquares,
      optimal: plan.fairness.optimal,
    },
  };
}

export interface CancelWeeklyAssignmentResult {
  cancelledAssignments: number;
  affectedUserIds: string[];
}

/**
 * 투표 조기 마감 취소(재오픈) 시 그 마감으로 실행된 배정을 되돌린다. 이미 실제로 시작된
 * 직감(DutyLog.startedAt 존재)이 하나라도 있으면 안전하게 취소를 거부한다.
 */
export async function cancelWeeklyAssignment(weekStart: Date): Promise<CancelWeeklyAssignmentResult> {
  const weekEnd = addDays(weekStart, 7);

  return prisma.$transaction(async (tx) => {
    const slots = await tx.dutySlot.findMany({
      where: { date: { gte: weekStart, lt: weekEnd } },
    });
    const slotIds = slots.map((s) => s.id);

    const assignments = await tx.dutyAssignment.findMany({
      where: { dutySlotId: { in: slotIds } },
      include: { dutyLog: true },
    });
    if (assignments.length === 0) {
      return { cancelledAssignments: 0, affectedUserIds: [] };
    }

    const alreadyStarted = assignments.some((a) => a.dutyLog?.startedAt);
    if (alreadyStarted) {
      throw new AssignmentCancelError(
        "이미 시작된 직감이 있어 배정을 취소할 수 없습니다. 관리자 화면에서 개별 확인해주세요."
      );
    }

    const assignmentIds = assignments.map((a) => a.id);

    await tx.checklistLog.deleteMany({
      where: { dutyLog: { assignmentId: { in: assignmentIds } } },
    });
    await tx.dutyLog.deleteMany({ where: { assignmentId: { in: assignmentIds } } });
    await tx.assignmentHistory.deleteMany({ where: { assignmentId: { in: assignmentIds } } });
    await tx.dutyExchangeRequest.deleteMany({
      where: {
        OR: [{ assignmentId: { in: assignmentIds } }, { targetAssignmentId: { in: assignmentIds } }],
      },
    });
    await tx.dutyAssignment.deleteMany({ where: { id: { in: assignmentIds } } });
    await tx.dutySlot.updateMany({ where: { id: { in: slotIds } }, data: { status: "OPEN" } });

    return {
      cancelledAssignments: assignments.length,
      affectedUserIds: Array.from(new Set(assignments.map((a) => a.userId))),
    };
  });
}
