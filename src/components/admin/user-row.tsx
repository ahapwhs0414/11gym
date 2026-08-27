"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

const GYM_LABEL: Record<string, string> = {
  GYM1: "힘레븐1",
  GYM2: "힘레븐2",
  ANY: "상관없음",
};

export function UserRow({
  id,
  name,
  status,
  gymPreference,
  createdAt,
}: {
  id: string;
  name: string;
  status: string;
  gymPreference: string;
  createdAt: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resetOpen, setResetOpen] = useState(false);
  const [newPin, setNewPin] = useState("");
  const [lastResetPin, setLastResetPin] = useState<string | null>(null);

  const isActive = status === "ACTIVE";

  async function toggleStatus() {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/users/${id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: isActive ? "INACTIVE" : "ACTIVE" }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "상태 변경에 실패했습니다.");
        setLoading(false);
        return;
      }
      router.refresh();
    } catch {
      setError("네트워크 오류가 발생했습니다.");
      setLoading(false);
    }
  }

  async function submitResetPin(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/users/${id}/reset-pin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin: newPin }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "PIN 초기화에 실패했습니다.");
        setLoading(false);
        return;
      }
      setLastResetPin(newPin);
      setNewPin("");
      setResetOpen(false);
      setLoading(false);
      router.refresh();
    } catch {
      setError("네트워크 오류가 발생했습니다.");
      setLoading(false);
    }
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="flex items-center justify-between">
        <div>
          <Link href={`/admin/users/${id}`} className="font-semibold text-slate-900 hover:underline">
            {name}
          </Link>
          <p className="mt-0.5 text-xs text-slate-500">
            {GYM_LABEL[gymPreference] ?? gymPreference} ·{" "}
            {new Date(createdAt).toLocaleDateString("ko-KR")} 등록
          </p>
        </div>
        <span
          className={`rounded-full px-2.5 py-1 text-xs font-medium ${
            isActive ? "bg-teal-50 text-teal-700" : "bg-slate-100 text-slate-500"
          }`}
        >
          {isActive ? "활성" : "비활성"}
        </span>
      </div>

      {lastResetPin && (
        <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700">
          새 PIN: <span className="font-mono font-semibold">{lastResetPin}</span>{" "}
          (사용자에게 직접 전달해주세요)
        </p>
      )}

      {error && (
        <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
          {error}
        </p>
      )}

      {resetOpen ? (
        <form onSubmit={submitResetPin} className="mt-3 flex items-center gap-2">
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={4}
            value={newPin}
            onChange={(e) => setNewPin(e.target.value)}
            required
            placeholder="새 PIN 4자리"
            className="flex-1 rounded-lg border border-slate-300 px-3 py-1.5 text-sm tracking-widest outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
          />
          <button
            type="submit"
            disabled={loading}
            className="rounded-lg bg-teal-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-teal-800 disabled:opacity-60"
          >
            확인
          </button>
          <button
            type="button"
            onClick={() => setResetOpen(false)}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100"
          >
            취소
          </button>
        </form>
      ) : (
        <div className="mt-3 flex gap-2">
          <button
            onClick={toggleStatus}
            disabled={loading}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-600 transition hover:bg-slate-100 disabled:opacity-60"
          >
            {isActive ? "비활성화" : "활성화"}
          </button>
          <button
            onClick={() => setResetOpen(true)}
            disabled={loading}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-600 transition hover:bg-slate-100 disabled:opacity-60"
          >
            PIN 초기화
          </button>
        </div>
      )}
    </div>
  );
}
