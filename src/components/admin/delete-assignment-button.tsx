"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function DeleteAssignmentButton({ assignmentId }: { assignmentId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleDelete() {
    const reason = window.prompt(
      "이 직감 기록을 완전히 삭제합니다. 삭제 사유를 입력해주세요 (예: 테스트 데이터, 잘못 생성된 기록)."
    );
    if (reason === null) return;
    if (!reason.trim()) {
      alert("삭제 사유를 입력해야 합니다.");
      return;
    }
    if (!confirm("정말 삭제할까요? 이 작업은 되돌릴 수 없습니다.")) return;

    setLoading(true);
    const res = await fetch(`/api/admin/assignments/${assignmentId}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason: reason.trim() }),
    });
    setLoading(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      alert(data.error ?? "삭제에 실패했습니다.");
      return;
    }
    router.refresh();
  }

  return (
    <button
      onClick={handleDelete}
      disabled={loading}
      title="이 기록 완전히 삭제"
      className="rounded-lg border border-red-200 px-2 py-1 text-xs font-medium text-red-600 transition hover:bg-red-50 disabled:opacity-60"
    >
      삭제
    </button>
  );
}
