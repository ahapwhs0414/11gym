"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type ChecklistItem = {
  id: string;
  name: string;
  required: boolean;
  completed: boolean;
};

export function DutyPanel({
  assignmentId,
  startedAt,
  startedLate,
  endedAt,
  endedEarly,
  checklistItems,
  issueNote,
}: {
  assignmentId: string;
  startedAt: string | null;
  startedLate: boolean;
  endedAt: string | null;
  endedEarly: boolean;
  checklistItems: ChecklistItem[];
  issueNote: string | null;
}) {
  const router = useRouter();
  const [checked, setChecked] = useState<Record<string, boolean>>(
    Object.fromEntries(checklistItems.map((c) => [c.id, c.completed]))
  );
  const [note, setNote] = useState(issueNote ?? "");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const started = !!startedAt;
  const ended = !!endedAt;
  const requiredItems = checklistItems.filter((c) => c.required);
  const allRequiredChecked = requiredItems.every((c) => checked[c.id]);

  async function handleStart() {
    setError(null);
    setLoading(true);
    const res = await fetch(`/api/duty/${assignmentId}/start`, { method: "POST" });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(data.error ?? "시작에 실패했습니다.");
      return;
    }
    router.refresh();
  }

  async function handleToggle(itemId: string, next: boolean) {
    setError(null);
    setChecked((prev) => ({ ...prev, [itemId]: next }));
    const res = await fetch(`/api/duty/${assignmentId}/checklist`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ checklistItemId: itemId, completed: next }),
    });
    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? "체크리스트 저장에 실패했습니다.");
      setChecked((prev) => ({ ...prev, [itemId]: !next }));
    }
  }

  async function handleEnd() {
    setError(null);
    setLoading(true);
    const res = await fetch(`/api/duty/${assignmentId}/end`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ note: note.trim() || undefined }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(data.error ?? "종료에 실패했습니다.");
      return;
    }
    router.refresh();
  }

  return (
    <div className="mt-4 space-y-4">
      {!started && (
        <button
          onClick={handleStart}
          disabled={loading}
          className="w-full rounded-lg bg-teal-700 py-3 text-sm font-semibold text-white transition hover:bg-teal-800 disabled:opacity-60"
        >
          {loading ? "처리 중..." : "직감 시작"}
        </button>
      )}

      {started && (
        <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm">
          <p className="text-slate-700">
            시작: {new Date(startedAt!).toLocaleTimeString("ko-KR")}{" "}
            {startedLate && <span className="font-semibold text-amber-600">(지각)</span>}
          </p>
          {ended && (
            <p className="mt-1 text-slate-700">
              종료: {new Date(endedAt!).toLocaleTimeString("ko-KR")}{" "}
              {endedEarly && <span className="font-semibold text-amber-600">(조기 종료)</span>}
            </p>
          )}
        </div>
      )}

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-900">업무 체크리스트</h2>
        <div className="mt-3 space-y-2">
          {checklistItems.map((item) => (
            <label
              key={item.id}
              className={`flex items-center justify-between rounded-lg border px-3 py-2 text-sm ${
                started && !ended ? "border-slate-200" : "border-slate-100 text-slate-400"
              }`}
            >
              <span>{item.name}</span>
              <input
                type="checkbox"
                checked={checked[item.id] ?? false}
                disabled={!started || ended}
                onChange={(e) => handleToggle(item.id, e.target.checked)}
                className="h-5 w-5 accent-teal-700"
              />
            </label>
          ))}
        </div>
      </div>

      {started && !ended && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <label className="text-sm font-semibold text-slate-900">
            문제 사항 / 건의 사항 <span className="font-normal text-slate-400">(선택)</span>
          </label>
          <p className="mt-1 text-xs text-slate-500">
            직감 중 발생한 문제나 건의할 내용이 있다면 자유롭게 적어주세요. 작성하지 않아도 종료할 수
            있습니다.
          </p>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            maxLength={1000}
            className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
          />
        </div>
      )}

      {started && !ended && (
        <button
          onClick={handleEnd}
          disabled={loading || !allRequiredChecked}
          className="w-full rounded-lg bg-slate-800 py-3 text-sm font-semibold text-white transition hover:bg-slate-900 disabled:opacity-40"
        >
          {loading ? "처리 중..." : "직감 종료"}
        </button>
      )}

      {ended && (
        <>
          <p className="rounded-lg bg-teal-50 px-3 py-2 text-center text-sm font-semibold text-teal-700">
            직감이 종료되었습니다.
          </p>
          {issueNote && (
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <p className="text-xs font-semibold text-slate-500">제출한 문제/건의 사항</p>
              <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">{issueNote}</p>
            </div>
          )}
        </>
      )}

      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
      )}
    </div>
  );
}
