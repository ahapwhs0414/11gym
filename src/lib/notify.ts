import "server-only";
import { prisma } from "@/lib/prisma";

// 명세서 §58: 인앱 알림. 푸시 발송은 Phase 9(PWA)에서 확장한다.
export type NotificationType =
  | "ASSIGNMENT_RESULT"
  | "EXCHANGE_REQUEST"
  | "EXCHANGE_ACCEPTED"
  | "NOTICE";

export async function notifyUser(params: {
  userId: string;
  type: NotificationType;
  title: string;
  content: string;
}) {
  await prisma.notification.create({
    data: {
      userId: params.userId,
      type: params.type,
      title: params.title,
      content: params.content,
    },
  });
}

export async function notifyUsers(
  userIds: string[],
  params: { type: NotificationType; title: string; content: string }
) {
  if (userIds.length === 0) return;
  await prisma.notification.createMany({
    data: userIds.map((userId) => ({
      userId,
      type: params.type,
      title: params.title,
      content: params.content,
    })),
  });
}
