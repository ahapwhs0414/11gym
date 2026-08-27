"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const STATUS_OPTIONS = [
  { value: "RECEIVED", label: "접수" },
  { value: "IN_REVIEW", label: "확인 중" },
  { value: "RESOLVED", label: "처리 완료" },
];

export function ComplaintRow({
  id,
  title,
  content,
  authorLabel,
  status,
  adminReply,
  createdAt,
}: {
  id: string;
  title: string;
  content: string;
  authorLabel: string;
  status: string;
  adminReply: string | null;
  createdAt: string;
}) {
  const router = useRouter();
  const [replyDraft, setReplyDraft] = useState(adminReply ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function updateStatus(newStatus: string) {
    setLoading(true);
    setError(null);
    const res = await fetch(`/api/admin/complaints/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
    setLoading(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "변경에 실패했습니다.");
      return;
    }
    router.refresh();
  }

  async function submitReply() {
    setLoading(true);
    setError(null);
    const res = await fetch(`/api/admin/complaints/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ adminReply: replyDraft }),
    });
    setLoading(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "답변 저장에 실패했습니다.");
      return;
    }
    router.refresh();
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-semibold text-slate-900">{title}</p>
          <p className="mt-0.5 text-xs text-slate-500">
            {authorLabel} · {new Date(createdAt).toLocaleString("ko-KR")}
          </p>
        </div>
        <select
          value={status}
          onChange={(e) => updateStatus(e.target.value)}
          disabled={loading}
          className="shrink-0 rounded-lg border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700 outline-none focus:border-teal-600"
        >
          {STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>
      <p className="mt-2 whitespace-pre-wrap text-sm text-slate-600">{content}</p>

      <div className="mt-3">
        <label className="text-xs font-medium text-slate-500">관리자 답변</label>
        <textarea
          value={replyDraft}
          onChange={(e) => setReplyDraft(e.target.value)}
          rows={2}
          maxLength={5000}
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
        />
        <button
          onClick={submitReply}
          disabled={loading}
          className="mt-2 rounded-lg bg-teal-700 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-teal-800 disabled:opacity-60"
        >
          답변 저장
        </button>
      </div>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  );
}
