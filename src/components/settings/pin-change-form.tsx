"use client";

import { useState, type FormEvent } from "react";

export function PinChangeForm() {
  const [currentPin, setCurrentPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    if (newPin !== confirmPin) {
      setError("새 PIN이 일치하지 않습니다.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/user/pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPin, newPin }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "PIN 변경에 실패했습니다.");
        setLoading(false);
        return;
      }
      setCurrentPin("");
      setNewPin("");
      setConfirmPin("");
      setSuccess(true);
      setLoading(false);
    } catch {
      setError("네트워크 오류가 발생했습니다.");
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-3 space-y-3">
      <div>
        <label className="mb-1.5 block text-sm font-medium text-slate-700">
          현재 PIN
        </label>
        <input
          type="tel"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={4}
          value={currentPin}
          onChange={(e) => setCurrentPin(e.target.value)}
          required
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm tracking-widest outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
          placeholder="0000"
        />
      </div>
      <div>
        <label className="mb-1.5 block text-sm font-medium text-slate-700">
          새 PIN
        </label>
        <input
          type="tel"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={4}
          value={newPin}
          onChange={(e) => setNewPin(e.target.value)}
          required
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm tracking-widest outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
          placeholder="0000"
        />
      </div>
      <div>
        <label className="mb-1.5 block text-sm font-medium text-slate-700">
          새 PIN 확인
        </label>
        <input
          type="tel"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={4}
          value={confirmPin}
          onChange={(e) => setConfirmPin(e.target.value)}
          required
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm tracking-widest outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
          placeholder="0000"
        />
      </div>

      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
          {error}
        </p>
      )}
      {success && !error && (
        <p className="rounded-lg bg-teal-50 px-3 py-2 text-sm text-teal-700">
          PIN이 변경되었습니다.
        </p>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-lg bg-teal-700 py-2 text-sm font-semibold text-white transition hover:bg-teal-800 disabled:opacity-60"
      >
        {loading ? "변경 중..." : "PIN 변경"}
      </button>
    </form>
  );
}
