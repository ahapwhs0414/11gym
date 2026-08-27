"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function VotingClosurePanel({
  weekStart,
  isClosed,
}: {
  weekStart: string;
  isClosed: boolean;
}) {
  const router = useRouter();
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);

  async function handleClose() {
    if (
      !confirm(
        "지금 투표를 마감하고 바로 자동 배정을 실행합니다. 아직 투표하지 않은 사용자는 이번 주 배정에서 제외됩니다. 계속할까요?"
      )
    ) {
      return;
    }
    setLoading(true);
    setError(null);
    setResult(null);
    const res = await fetch("/api/admin/voting/close", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ weekStart, reason: reason.trim() || undefined }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(data.error ?? "마감에 실패했습니다.");
      return;
    }
    setResult(
      `배정 완료: ${data.result.createdAssignments}건 생성, 미배정 ${data.result.understaffedSlots.length}건`
    );
    router.refresh();
  }

  async function handleReopen() {
    if (!confirm("조기 마감을 취소하고 다시 투표를 받을까요? (이미 실행된 배정은 유지됩니다)")) {
      return;
    }
    setLoading(true);
    setError(null);
    const res = await fetch("/api/admin/voting/reopen", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ weekStart }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(data.error ?? "재오픈에 실패했습니다.");
      return;
    }
    router.refresh();
  }

  if (isClosed) {
    return (
      <div>
        <p className="text-sm text-slate-600">
          이 주는 관리자에 의해 조기 마감되었습니다. 재오픈하면 사용자가 다시 투표할 수 있습니다
          (이미 생성된 배정은 그대로 유지됩니다).
        </p>
        <button
          onClick={handleReopen}
          disabled={loading}
          className="mt-3 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100 disabled:opacity-60"
        >
          투표 재오픈
        </button>
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      </div>
    );
  }

  return (
    <div>
      <p className="text-sm text-slate-600">
        정규 마감(금요일 21:00) 전에 지금 바로 투표를 마감하고 자동 배정을 실행합니다.
      </p>
      <div className="mt-3 flex flex-wrap items-end gap-2">
        <div className="flex-1">
          <label className="text-xs font-medium text-slate-500">사유 (선택)</label>
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="예: 전원 투표 완료로 조기 마감"
            maxLength={200}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
          />
        </div>
        <button
          onClick={handleClose}
          disabled={loading}
          className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-amber-700 disabled:opacity-60"
        >
          {loading ? "처리 중..." : "지금 마감하고 배정 실행"}
        </button>
      </div>
      {result && <p className="mt-2 text-sm text-teal-700">{result}</p>}
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  );
}
