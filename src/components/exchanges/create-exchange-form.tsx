"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type AssignmentOption = {
  id: string;
  label: string;
};

export function CreateExchangeForm({
  myAssignments,
  otherUsers,
  othersAssignments,
}: {
  myAssignments: AssignmentOption[];
  otherUsers: { id: string; name: string }[];
  othersAssignments: Record<string, AssignmentOption[]>;
}) {
  const router = useRouter();
  const [assignmentId, setAssignmentId] = useState(myAssignments[0]?.id ?? "");
  const [replacementUserId, setReplacementUserId] = useState(otherUsers[0]?.id ?? "");
  const [exchangeType, setExchangeType] = useState<"ONE_WAY" | "TWO_WAY">("ONE_WAY");
  const [targetAssignmentId, setTargetAssignmentId] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(false);

  const targetOptions = useMemo(
    () => othersAssignments[replacementUserId] ?? [],
    [othersAssignments, replacementUserId]
  );

  if (myAssignments.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-slate-300 bg-white p-4 text-center text-sm text-slate-400">
        교환 요청할 수 있는 예정된 직감이 없습니다.
      </p>
    );
  }
  if (otherUsers.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-slate-300 bg-white p-4 text-center text-sm text-slate-400">
        교환을 요청할 수 있는 다른 사용자가 없습니다.
      </p>
    );
  }

  async function handleSubmit() {
    setError(null);
    setSaved(false);
    if (exchangeType === "TWO_WAY" && !targetAssignmentId) {
      setError("교환할 상대방의 직감을 선택해주세요.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/exchanges", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assignmentId,
          replacementUserId,
          exchangeType,
          targetAssignmentId: exchangeType === "TWO_WAY" ? targetAssignmentId : undefined,
          reason: reason.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "요청에 실패했습니다.");
        setLoading(false);
        return;
      }
      setSaved(true);
      setLoading(false);
      setReason("");
      router.refresh();
    } catch {
      setError("네트워크 오류가 발생했습니다.");
      setLoading(false);
    }
  }

  return (
    <div className="space-y-3">
      <div>
        <label className="text-xs font-medium text-slate-500">내 직감</label>
        <select
          value={assignmentId}
          onChange={(e) => setAssignmentId(e.target.value)}
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
        >
          {myAssignments.map((a) => (
            <option key={a.id} value={a.id}>
              {a.label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="text-xs font-medium text-slate-500">교환 방식</label>
        <div className="mt-1 flex gap-2">
          <button
            type="button"
            onClick={() => setExchangeType("ONE_WAY")}
            className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium ${
              exchangeType === "ONE_WAY"
                ? "bg-teal-700 text-white"
                : "border border-slate-300 text-slate-600"
            }`}
          >
            양도 (단방향)
          </button>
          <button
            type="button"
            onClick={() => setExchangeType("TWO_WAY")}
            className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium ${
              exchangeType === "TWO_WAY"
                ? "bg-teal-700 text-white"
                : "border border-slate-300 text-slate-600"
            }`}
          >
            교환 (양방향)
          </button>
        </div>
      </div>

      <div>
        <label className="text-xs font-medium text-slate-500">대체자</label>
        <select
          value={replacementUserId}
          onChange={(e) => {
            setReplacementUserId(e.target.value);
            setTargetAssignmentId("");
          }}
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
        >
          {otherUsers.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name}
            </option>
          ))}
        </select>
      </div>

      {exchangeType === "TWO_WAY" && (
        <div>
          <label className="text-xs font-medium text-slate-500">대신 받을 상대방의 직감</label>
          {targetOptions.length === 0 ? (
            <p className="mt-1 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-400">
              이 사용자는 교환 가능한 예정된 직감이 없습니다.
            </p>
          ) : (
            <select
              value={targetAssignmentId}
              onChange={(e) => setTargetAssignmentId(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
            >
              <option value="">선택해주세요</option>
              {targetOptions.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.label}
                </option>
              ))}
            </select>
          )}
        </div>
      )}

      <div>
        <label className="text-xs font-medium text-slate-500">사유 (선택)</label>
        <input
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          maxLength={200}
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
        />
      </div>

      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
      )}
      {saved && !error && (
        <p className="rounded-lg bg-teal-50 px-3 py-2 text-sm text-teal-700">
          교환 요청을 보냈습니다.
        </p>
      )}

      <button
        onClick={handleSubmit}
        disabled={loading}
        className="w-full rounded-lg bg-teal-700 py-2 text-sm font-semibold text-white transition hover:bg-teal-800 disabled:opacity-60"
      >
        {loading ? "요청 중..." : "교환 요청 보내기"}
      </button>
    </div>
  );
}
