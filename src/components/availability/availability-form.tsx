"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type Slot = {
  id: string;
  dayLabel: string;
  dateLabel: string;
  startTime: string;
  endTime: string;
  available: boolean;
  voteCount: number;
};

export function AvailabilityForm({
  slots,
  hasSubmitted,
  readOnly = false,
}: {
  slots: Slot[];
  hasSubmitted: boolean;
  readOnly?: boolean;
}) {
  const router = useRouter();
  const initialAllUnavailable = hasSubmitted && slots.every((s) => !s.available);

  const [values, setValues] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(slots.map((s) => [s.id, s.available]))
  );
  const [allUnavailable, setAllUnavailable] = useState(initialAllUnavailable);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(false);

  const groups = useMemo(() => {
    const map = new Map<string, Slot[]>();
    for (const slot of slots) {
      const key = `${slot.dayLabel}-${slot.dateLabel}`;
      const arr = map.get(key) ?? [];
      arr.push(slot);
      map.set(key, arr);
    }
    return Array.from(map.entries());
  }, [slots]);

  function toggleSlot(id: string) {
    setSaved(false);
    setAllUnavailable(false);
    setValues((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  function toggleAllUnavailable() {
    setSaved(false);
    setAllUnavailable((prev) => !prev);
  }

  async function handleSave() {
    setError(null);
    setSaved(false);
    setLoading(true);
    try {
      const res = await fetch("/api/availability", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          allUnavailable,
          slots: slots.map((s) => ({ slotId: s.id, available: values[s.id] ?? false })),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "저장에 실패했습니다.");
        setLoading(false);
        return;
      }
      setSaved(true);
      setLoading(false);
      router.refresh();
    } catch {
      setError("네트워크 오류가 발생했습니다.");
      setLoading(false);
    }
  }

  return (
    <div>
      <div className="space-y-4">
        {groups.map(([key, daySlots]) => (
          <div key={key}>
            <p className="text-sm font-semibold text-slate-700">
              {daySlots[0].dayLabel}요일 · {daySlots[0].dateLabel}
            </p>
            <div className="mt-2 space-y-2">
              {daySlots.map((slot) => {
                const checked = allUnavailable ? false : values[slot.id] ?? false;
                return (
                  <label
                    key={slot.id}
                    className={`flex items-center justify-between rounded-lg border px-3 py-2 text-sm ${
                      allUnavailable
                        ? "border-slate-100 bg-slate-50 text-slate-400"
                        : "border-slate-200"
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <span>
                        {slot.startTime} ~ {slot.endTime}
                      </span>
                      <span className="text-xs text-slate-400">
                        {slot.voteCount}명 투표
                      </span>
                    </span>
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={allUnavailable || readOnly}
                      onChange={() => toggleSlot(slot.id)}
                      className="h-5 w-5 accent-teal-700"
                    />
                  </label>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <label className="mt-6 flex items-center gap-2 rounded-lg border border-dashed border-slate-300 px-3 py-3 text-sm text-slate-600">
        <input
          type="checkbox"
          checked={allUnavailable}
          disabled={readOnly}
          onChange={toggleAllUnavailable}
          className="h-5 w-5 accent-teal-700"
        />
        이번 주에는 모든 시간에 직감을 설 수 없습니다.
      </label>

      {error && (
        <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
      )}
      {saved && !error && (
        <p className="mt-3 rounded-lg bg-teal-50 px-3 py-2 text-sm text-teal-700">
          저장되었습니다.
        </p>
      )}

      <button
        onClick={handleSave}
        disabled={loading || readOnly}
        className="mt-4 w-full rounded-lg bg-teal-700 py-2 text-sm font-semibold text-white transition hover:bg-teal-800 disabled:opacity-60"
      >
        {readOnly ? "마감됨" : loading ? "저장 중..." : "저장"}
      </button>
    </div>
  );
}
