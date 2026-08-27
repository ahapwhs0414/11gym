import Link from "next/link";
import { requireUserSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { LogoutButton } from "@/components/logout-button";
import { CreateExchangeForm } from "@/components/exchanges/create-exchange-form";
import { ExchangeActionButtons } from "@/components/exchanges/exchange-action-buttons";

const DAY_LABELS = ["일", "월", "화", "수", "목", "금", "토"];
const STATUS_LABELS: Record<string, string> = {
  PENDING: "대기 중",
  ACCEPTED: "수락됨",
  REJECTED: "거절됨",
  CANCELLED: "취소됨",
};

function toDateOnly(date: Date) {
  return date.toISOString().slice(0, 10);
}

function formatSlot(date: Date, startTime: string, endTime: string) {
  return `${date.getUTCMonth() + 1}/${date.getUTCDate()}(${DAY_LABELS[date.getUTCDay()]}) ${startTime}~${endTime}`;
}

export default async function ExchangesPage() {
  const session = await requireUserSession();
  const todayStart = new Date(toDateOnly(new Date()));

  const [myUpcoming, otherActiveUsers, incoming, outgoing] = await Promise.all([
    prisma.dutyAssignment.findMany({
      where: {
        userId: session.userId,
        dutySlot: { date: { gte: todayStart } },
        NOT: { dutyLog: { status: "COMPLETED" } },
      },
      include: { dutySlot: true, gym: true },
      orderBy: [{ dutySlot: { date: "asc" } }],
    }),
    prisma.user.findMany({
      where: { role: "USER", status: "ACTIVE", id: { not: session.userId } },
      orderBy: { name: "asc" },
    }),
    prisma.dutyExchangeRequest.findMany({
      where: { replacementUserId: session.userId, status: "PENDING" },
      include: {
        requester: true,
        sourceAssignment: { include: { dutySlot: true, gym: true } },
        targetAssignment: { include: { dutySlot: true, gym: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.dutyExchangeRequest.findMany({
      where: { requesterId: session.userId },
      include: {
        replacement: true,
        sourceAssignment: { include: { dutySlot: true, gym: true } },
        targetAssignment: { include: { dutySlot: true, gym: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const othersUpcoming = await prisma.dutyAssignment.findMany({
    where: {
      userId: { in: otherActiveUsers.map((u) => u.id) },
      dutySlot: { date: { gte: todayStart } },
      NOT: { dutyLog: { status: "COMPLETED" } },
    },
    include: { dutySlot: true, gym: true },
    orderBy: [{ dutySlot: { date: "asc" } }],
  });
  const othersAssignmentsByUser: Record<string, { id: string; label: string }[]> = {};
  for (const u of otherActiveUsers) othersAssignmentsByUser[u.id] = [];
  for (const a of othersUpcoming) {
    othersAssignmentsByUser[a.userId]?.push({
      id: a.id,
      label: `${formatSlot(a.dutySlot.date, a.dutySlot.startTime, a.dutySlot.endTime)} · ${a.gym.name}`,
    });
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3">
        <Link href="/home" className="text-sm font-semibold text-slate-900">
          직감 관리 시스템
        </Link>
        <LogoutButton redirectTo="/login" />
      </header>

      <main className="mx-auto max-w-md px-4 py-8">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-xl font-bold text-slate-900">직감 교환</h1>
          <Link href="/home" className="text-sm text-teal-700 hover:underline">
            ← 홈으로
          </Link>
        </div>

        <section>
          <h2 className="text-sm font-semibold text-slate-700">받은 교환 요청</h2>
          <div className="mt-2 space-y-2">
            {incoming.length === 0 && (
              <p className="rounded-xl border border-dashed border-slate-300 bg-white p-4 text-center text-sm text-slate-400">
                받은 요청이 없습니다.
              </p>
            )}
            {incoming.map((req) => (
              <div key={req.id} className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm">
                <p className="font-semibold text-slate-900">{req.requester.name}님의 요청</p>
                <p className="mt-1 text-slate-600">
                  {formatSlot(
                    req.sourceAssignment.dutySlot.date,
                    req.sourceAssignment.dutySlot.startTime,
                    req.sourceAssignment.dutySlot.endTime
                  )}{" "}
                  · {req.sourceAssignment.gym.name}을 넘겨받습니다.
                </p>
                {req.exchangeType === "TWO_WAY" && req.targetAssignment && (
                  <p className="mt-1 text-slate-600">
                    대신 내 직감{" "}
                    {formatSlot(
                      req.targetAssignment.dutySlot.date,
                      req.targetAssignment.dutySlot.startTime,
                      req.targetAssignment.dutySlot.endTime
                    )}{" "}
                    · {req.targetAssignment.gym.name}을 넘겨줍니다.
                  </p>
                )}
                {req.reason && <p className="mt-1 text-xs text-slate-500">사유: {req.reason}</p>}
                <div className="mt-2 flex justify-end gap-2">
                  <ExchangeActionButtons
                    exchangeId={req.id}
                    action="reject"
                    label="거절"
                    variant="secondary"
                  />
                  <ExchangeActionButtons exchangeId={req.id} action="accept" label="수락" />
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-6">
          <h2 className="text-sm font-semibold text-slate-700">보낸 교환 요청</h2>
          <div className="mt-2 space-y-2">
            {outgoing.length === 0 && (
              <p className="rounded-xl border border-dashed border-slate-300 bg-white p-4 text-center text-sm text-slate-400">
                보낸 요청이 없습니다.
              </p>
            )}
            {outgoing.map((req) => (
              <div key={req.id} className="rounded-xl border border-slate-200 bg-white p-3 text-sm">
                <div className="flex items-center justify-between">
                  <p className="font-semibold text-slate-900">
                    {req.replacement?.name ?? "알 수 없음"}에게 요청
                  </p>
                  <span className="text-xs font-medium text-slate-500">
                    {STATUS_LABELS[req.status]}
                  </span>
                </div>
                <p className="mt-1 text-slate-600">
                  {formatSlot(
                    req.sourceAssignment.dutySlot.date,
                    req.sourceAssignment.dutySlot.startTime,
                    req.sourceAssignment.dutySlot.endTime
                  )}{" "}
                  · {req.sourceAssignment.gym.name}
                </p>
                {req.status === "PENDING" && (
                  <div className="mt-2 flex justify-end">
                    <ExchangeActionButtons
                      exchangeId={req.id}
                      action="cancel"
                      label="요청 취소"
                      variant="secondary"
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>

        <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-900">새 교환 요청</h2>
          <div className="mt-3">
            <CreateExchangeForm
              myAssignments={myUpcoming.map((a) => ({
                id: a.id,
                label: `${formatSlot(a.dutySlot.date, a.dutySlot.startTime, a.dutySlot.endTime)} · ${a.gym.name}`,
              }))}
              otherUsers={otherActiveUsers.map((u) => ({ id: u.id, name: u.name }))}
              othersAssignments={othersAssignmentsByUser}
            />
          </div>
        </section>
      </main>
    </div>
  );
}
