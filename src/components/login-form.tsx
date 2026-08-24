"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

type Mode = "user" | "admin";

const MODE_CONFIG: Record<
  Mode,
  {
    endpoint: string;
    title: string;
    subtitle: string;
    secondFieldLabel: string;
    secondFieldPlaceholder: string;
    secondFieldType: string;
    secondFieldMaxLength?: number;
    redirectTo: string;
  }
> = {
  user: {
    endpoint: "/api/auth/login",
    title: "직감 관리 시스템",
    subtitle: "이름과 4자리 PIN으로 로그인하세요",
    secondFieldLabel: "PIN",
    secondFieldPlaceholder: "0000",
    secondFieldType: "tel",
    secondFieldMaxLength: 4,
    redirectTo: "/home",
  },
  admin: {
    endpoint: "/api/auth/admin-login",
    title: "관리자 로그인",
    subtitle: "관리자 아이디와 비밀번호를 입력하세요",
    secondFieldLabel: "비밀번호",
    secondFieldPlaceholder: "비밀번호",
    secondFieldType: "password",
    redirectTo: "/admin/dashboard",
  },
};

export function LoginForm({ mode }: { mode: Mode }) {
  const config = MODE_CONFIG[mode];
  const router = useRouter();
  const [name, setName] = useState("");
  const [secondValue, setSecondValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const body =
        mode === "user"
          ? { name, pin: secondValue }
          : { name, password: secondValue };

      const res = await fetch(config.endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "로그인에 실패했습니다.");
        setLoading(false);
        return;
      }

      router.push(config.redirectTo);
      router.refresh();
    } catch {
      setError("네트워크 오류가 발생했습니다. 다시 시도해주세요.");
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold text-slate-900">{config.title}</h1>
          <p className="mt-2 text-sm text-slate-500">{config.subtitle}</p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
        >
          <div className="mb-4">
            <label
              htmlFor="name"
              className="mb-1.5 block text-sm font-medium text-slate-700"
            >
              {mode === "user" ? "이름" : "관리자 아이디"}
            </label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoComplete={mode === "user" ? "name" : "username"}
              className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-base outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
              placeholder={mode === "user" ? "홍길동" : "admin"}
            />
          </div>

          <div className="mb-6">
            <label
              htmlFor="second"
              className="mb-1.5 block text-sm font-medium text-slate-700"
            >
              {config.secondFieldLabel}
            </label>
            <input
              id="second"
              type={config.secondFieldType}
              inputMode={mode === "user" ? "numeric" : undefined}
              pattern={mode === "user" ? "[0-9]*" : undefined}
              maxLength={config.secondFieldMaxLength}
              value={secondValue}
              onChange={(e) => setSecondValue(e.target.value)}
              required
              autoComplete={mode === "user" ? "off" : "current-password"}
              className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-base tracking-widest outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
              placeholder={config.secondFieldPlaceholder}
            />
          </div>

          {error && (
            <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-teal-700 py-2.5 text-base font-semibold text-white transition hover:bg-teal-800 disabled:opacity-60"
          >
            {loading ? "로그인 중..." : "로그인"}
          </button>
        </form>

        {mode === "user" && (
          <p className="mt-6 text-center text-xs text-slate-400">
            계정이 없으신가요? 관리자에게 문의해주세요.
          </p>
        )}
      </div>
    </div>
  );
}
