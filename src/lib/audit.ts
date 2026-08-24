import "server-only";
import { prisma } from "./prisma";

export async function writeAuditLog(params: {
  actorId: string;
  action: string;
  targetType: string;
  targetId: string;
  beforeData?: object;
  afterData?: object;
  reason?: string;
}) {
  await prisma.auditLog.create({
    data: {
      actorId: params.actorId,
      action: params.action,
      targetType: params.targetType,
      targetId: params.targetId,
      beforeData: params.beforeData,
      afterData: params.afterData,
      reason: params.reason,
    },
  });
}
