import "server-only";
import { prisma } from "@/lib/prisma";
import type { ExchangeType } from "@prisma/client";

export class ExchangeError extends Error {}

function toDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** 명세서 §37/§40: 직감 교환 요청을 생성한다 (관리자 승인 불필요). */
export async function createExchangeRequest(params: {
  requesterId: string;
  assignmentId: string;
  replacementUserId: string;
  exchangeType: ExchangeType;
  targetAssignmentId?: string;
  reason?: string;
}) {
  const { requesterId, assignmentId, replacementUserId, exchangeType, targetAssignmentId, reason } =
    params;

  if (replacementUserId === requesterId) {
    throw new ExchangeError("본인에게는 교환을 요청할 수 없습니다.");
  }

  const assignment = await prisma.dutyAssignment.findUnique({
    where: { id: assignmentId },
    include: { dutySlot: true },
  });
  if (!assignment || assignment.userId !== requesterId) {
    throw new ExchangeError("본인의 배정만 교환 요청할 수 있습니다.");
  }
  const today = toDateOnly(new Date());
  if (toDateOnly(assignment.dutySlot.date) < today) {
    throw new ExchangeError("이미 지난 직감은 교환할 수 없습니다.");
  }

  const existingPending = await prisma.dutyExchangeRequest.findFirst({
    where: { assignmentId, status: "PENDING" },
  });
  if (existingPending) {
    throw new ExchangeError("이미 대기 중인 교환 요청이 있습니다.");
  }

  const replacement = await prisma.user.findUnique({ where: { id: replacementUserId } });
  if (!replacement || replacement.role !== "USER" || replacement.status !== "ACTIVE") {
    throw new ExchangeError("대상 사용자를 찾을 수 없습니다.");
  }

  if (exchangeType === "TWO_WAY") {
    if (!targetAssignmentId) {
      throw new ExchangeError("교환할 상대방의 직감을 선택해주세요.");
    }
    const targetAssignment = await prisma.dutyAssignment.findUnique({
      where: { id: targetAssignmentId },
      include: { dutySlot: true },
    });
    if (!targetAssignment || targetAssignment.userId !== replacementUserId) {
      throw new ExchangeError("상대방의 배정이 아닙니다.");
    }
    if (toDateOnly(targetAssignment.dutySlot.date) < today) {
      throw new ExchangeError("이미 지난 직감은 교환할 수 없습니다.");
    }
  }

  return prisma.dutyExchangeRequest.create({
    data: {
      assignmentId,
      requesterId,
      replacementUserId,
      exchangeType,
      targetAssignmentId: exchangeType === "TWO_WAY" ? targetAssignmentId : null,
      reason,
    },
  });
}

export async function cancelExchangeRequest(exchangeId: string, actingUserId: string) {
  const request = await prisma.dutyExchangeRequest.findUnique({ where: { id: exchangeId } });
  if (!request) throw new ExchangeError("요청을 찾을 수 없습니다.");
  if (request.requesterId !== actingUserId) throw new ExchangeError("본인의 요청만 취소할 수 있습니다.");
  if (request.status !== "PENDING") throw new ExchangeError("이미 처리된 요청입니다.");

  await prisma.dutyExchangeRequest.update({
    where: { id: exchangeId },
    data: { status: "CANCELLED" },
  });
}

export async function rejectExchangeRequest(exchangeId: string, actingUserId: string) {
  const request = await prisma.dutyExchangeRequest.findUnique({ where: { id: exchangeId } });
  if (!request) throw new ExchangeError("요청을 찾을 수 없습니다.");
  if (request.replacementUserId !== actingUserId) {
    throw new ExchangeError("본인에게 온 요청만 거절할 수 있습니다.");
  }
  if (request.status !== "PENDING") throw new ExchangeError("이미 처리된 요청입니다.");

  await prisma.dutyExchangeRequest.update({
    where: { id: exchangeId },
    data: { status: "REJECTED" },
  });
}

/**
 * 명세서 §40의 검증을 모두 통과해야 수락이 확정된다:
 * 상대방 활성 계정 여부, 해당 시간 가능 여부, 동일 날짜 중복 방지, 하루 2회 방지.
 */
export async function acceptExchangeRequest(exchangeId: string, actingUserId: string) {
  await prisma.$transaction(async (tx) => {
    const request = await tx.dutyExchangeRequest.findUnique({
      where: { id: exchangeId },
      include: {
        sourceAssignment: { include: { dutySlot: true } },
        targetAssignment: { include: { dutySlot: true } },
      },
    });
    if (!request) throw new ExchangeError("요청을 찾을 수 없습니다.");
    if (request.status !== "PENDING") throw new ExchangeError("이미 처리된 요청입니다.");
    if (request.replacementUserId !== actingUserId) {
      throw new ExchangeError("본인에게 온 요청만 수락할 수 있습니다.");
    }

    const replacement = await tx.user.findUnique({ where: { id: actingUserId } });
    if (!replacement || replacement.status !== "ACTIVE") {
      throw new ExchangeError("활성 계정이 아닙니다.");
    }
    const requester = await tx.user.findUnique({ where: { id: request.requesterId } });
    if (!requester || requester.status !== "ACTIVE") {
      throw new ExchangeError("요청자가 활성 계정이 아닙니다.");
    }

    const sourceSlot = request.sourceAssignment.dutySlot;

    const replacementAvailability = await tx.availability.findUnique({
      where: { userId_dutySlotId: { userId: actingUserId, dutySlotId: sourceSlot.id } },
    });
    if (!replacementAvailability?.available) {
      throw new ExchangeError("해당 시간에 가능하다고 표시하지 않았습니다.");
    }

    const replacementSameDay = await tx.dutyAssignment.findMany({
      where: { userId: actingUserId, dutySlot: { date: sourceSlot.date } },
    });
    if (replacementSameDay.some((a) => a.id !== request.targetAssignmentId)) {
      throw new ExchangeError("해당 날짜에 이미 다른 직감이 있습니다.");
    }

    if (request.exchangeType === "TWO_WAY") {
      if (!request.targetAssignment) throw new ExchangeError("교환 대상 배정이 없습니다.");
      const targetSlot = request.targetAssignment.dutySlot;

      const requesterAvailability = await tx.availability.findUnique({
        where: { userId_dutySlotId: { userId: request.requesterId, dutySlotId: targetSlot.id } },
      });
      if (!requesterAvailability?.available) {
        throw new ExchangeError("요청자가 상대방 시간에 가능하다고 표시하지 않았습니다.");
      }

      const requesterSameDay = await tx.dutyAssignment.findMany({
        where: { userId: request.requesterId, dutySlot: { date: targetSlot.date } },
      });
      if (requesterSameDay.some((a) => a.id !== request.assignmentId)) {
        throw new ExchangeError("요청자가 해당 날짜에 이미 다른 직감이 있습니다.");
      }

      await tx.dutyAssignment.update({
        where: { id: request.assignmentId },
        data: { userId: actingUserId, assignedType: "EXCHANGE" },
      });
      await tx.dutyAssignment.update({
        where: { id: request.targetAssignmentId! },
        data: { userId: request.requesterId, assignedType: "EXCHANGE" },
      });
      await tx.assignmentHistory.create({
        data: {
          assignmentId: request.assignmentId,
          fromUserId: request.requesterId,
          toUserId: actingUserId,
          changeType: "EXCHANGE",
          reason: request.reason,
        },
      });
      await tx.assignmentHistory.create({
        data: {
          assignmentId: request.targetAssignmentId!,
          fromUserId: actingUserId,
          toUserId: request.requesterId,
          changeType: "EXCHANGE",
          reason: request.reason,
        },
      });
    } else {
      await tx.dutyAssignment.update({
        where: { id: request.assignmentId },
        data: { userId: actingUserId, assignedType: "EXCHANGE" },
      });
      await tx.assignmentHistory.create({
        data: {
          assignmentId: request.assignmentId,
          fromUserId: request.requesterId,
          toUserId: actingUserId,
          changeType: "EXCHANGE",
          reason: request.reason,
        },
      });
    }

    await tx.dutyExchangeRequest.update({
      where: { id: exchangeId },
      data: { status: "ACCEPTED", acceptedAt: new Date() },
    });
  });
}
