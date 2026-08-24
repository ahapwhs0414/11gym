import { SessionOptions } from "iron-session";

export interface SessionData {
  userId?: string;
  role?: "USER" | "ADMIN";
  name?: string;
}

if (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 32) {
  // 개발 중 실수로 짧은/빈 시크릿을 쓰는 것을 방지합니다.
  // 배포 전 반드시 .env의 SESSION_SECRET을 32자 이상 랜덤 문자열로 교체하세요.
  console.warn(
    "[경고] SESSION_SECRET이 설정되지 않았거나 너무 짧습니다. .env 파일을 확인하세요."
  );
}

export const sessionOptions: SessionOptions = {
  password: process.env.SESSION_SECRET ?? "dev-only-insecure-secret-change-me-please-32chars",
  cookieName: "gym_duty_session",
  cookieOptions: {
    secure: process.env.NODE_ENV === "production",
    httpOnly: true,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 7, // 7일 유지
  },
};
