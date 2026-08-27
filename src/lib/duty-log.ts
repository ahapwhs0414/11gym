import "server-only";
import { prisma } from "@/lib/prisma";
import { getLateGraceMinutes } from "@/lib/settings";
import type { DutyLog } from "@prisma/client";

export class DutyLogError extends Error {}

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

/** DutySlot의 날짜(UTC 자정)와 "HH:mm"(KST 기준 문자열)로 실제 UTC Date를 계산한다. */
function slotTimeToDate(slotDate: Date, hhmm: string): Date {
  const [hh, mm] = hhmm.split(":").map(Number);
  const utcMidnight = Date.UTC(
    slotDate.getUTCFullYear(),
    slotDate.getUTCMonth(),
    slotDate.getUTCDate()
  );
  return new Date(utcMidnight + hh * 3600000 + mm * 60000 - KST_OFFSET_MS);
}

/** 배정에 대한 DutyLog가 없으면 생성한다 (아직 시작 전 SCHEDULED 상태). */
export async function ensureDutyLog(assignmentId: string): Promise<DutyLog> {
  return prisma.dutyLog.upsert({
    where: { assignmentId },
    update: {},
    create: { assignmentId },
  });
}

async function ensureChecklistLogs(dutyLogId: string) {
  const items = await prisma.checklistItem.findMany({ where: { active: true } });
  await prisma.checklistLog.createMany({
    data: items.map((item) => ({ dutyLogId, checklistItemId: item.id })),
    skipDuplicates: true,
  });
}

async function loadAssignmentForDuty(assignmentId: string, userId: string) {
  const assignment = await prisma.dutyAssignment.findUnique({
    where: { id: assignmentId },
    include: { dutySlot: true },
  });
  if (!assignment || assignment.userId !== userId) {
    throw new DutyLogError("본인의 직감만 처리할 수 있습니다.");
  }
  return assignment;
}

export async function startDuty(assignmentId: string, userId: string) {
  const assignment = await loadAssignmentForDuty(assignmentId, userId);
  const dutyLog = await ensureDutyLog(assignmentId);
  if (dutyLog.startedAt) {
    throw new DutyLogError("이미 시작된 직감입니다.");
  }

  const now = new Date();
  const scheduledStart = slotTimeToDate(assignment.dutySlot.date, assignment.dutySlot.startTime);
  const graceMinutes = await getLateGraceMinutes();
  const startedLate = now.getTime() > scheduledStart.getTime() + graceMinutes * 60000;

  await ensureChecklistLogs(dutyLog.id);

  return prisma.dutyLog.update({
    where: { id: dutyLog.id },
    data: { startedAt: now, startedLate },
  });
}

export async function toggleChecklistItem(
  assignmentId: string,
  userId: string,
  checklistItemId: string,
  completed: boolean
) {
  await loadAssignmentForDuty(assignmentId, userId);
  const dutyLog = await ensureDutyLog(assignmentId);
  if (!dutyLog.startedAt) {
    throw new DutyLogError("먼저 직감을 시작해주세요.");
  }
  if (dutyLog.endedAt) {
    throw new DutyLogError("이미 종료된 직감입니다.");
  }

  await prisma.checklistLog.upsert({
    where: { dutyLogId_checklistItemId: { dutyLogId: dutyLog.id, checklistItemId } },
    update: { completed, completedAt: completed ? new Date() : null },
    create: { dutyLogId: dutyLog.id, checklistItemId, completed, completedAt: completed ? new Date() : null },
  });
}

export async function endDuty(assignmentId: string, userId: string, issueNote?: string) {
  const assignment = await loadAssignmentForDuty(assignmentId, userId);
  const dutyLog = await ensureDutyLog(assignmentId);
  if (!dutyLog.startedAt) {
    throw new DutyLogError("먼저 직감을 시작해주세요.");
  }
  if (dutyLog.endedAt) {
    throw new DutyLogError("이미 종료된 직감입니다.");
  }

  const requiredItems = await prisma.checklistItem.findMany({
    where: { active: true, required: true },
  });
  const logs = await prisma.checklistLog.findMany({ where: { dutyLogId: dutyLog.id } });
  const completedIds = new Set(logs.filter((l) => l.completed).map((l) => l.checklistItemId));
  const allRequiredDone = requiredItems.every((item) => completedIds.has(item.id));
  if (!allRequiredDone) {
    throw new DutyLogError("필수 체크리스트를 모두 완료해야 종료할 수 있습니다.");
  }

  const now = new Date();
  const scheduledEnd = slotTimeToDate(assignment.dutySlot.date, assignment.dutySlot.endTime);
  const endedEarly = now.getTime() < scheduledEnd.getTime();

  return prisma.dutyLog.update({
    where: { id: dutyLog.id },
    data: {
      endedAt: now,
      endedEarly,
      status: "COMPLETED",
      issueNote: issueNote?.trim() || null,
    },
  });
}

/** 관리자용: 출석 기록 없이 예정 시간이 지난 배정을 결석으로 표시한다 (§48). */
export async function markAbsent(assignmentId: string) {
  const dutyLog = await ensureDutyLog(assignmentId);
  if (dutyLog.startedAt) {
    throw new DutyLogError("이미 출석한 직감은 결석으로 표시할 수 없습니다.");
  }
  return prisma.dutyLog.update({ where: { id: dutyLog.id }, data: { status: "ABSENT" } });
}
