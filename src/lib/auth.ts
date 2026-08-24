import "server-only";
import { cookies } from "next/headers";
import { getIronSession, type IronSession } from "iron-session";
import { redirect } from "next/navigation";
import { sessionOptions, type SessionData } from "./session";

/**
 * Route Handler / Server Component에서 세션을 읽고/쓰는 데 사용합니다.
 * 예:
 *   const session = await getSession();
 *   session.userId = user.id;
 *   await session.save();
 */
export async function getSession(): Promise<IronSession<SessionData>> {
  const cookieStore = await cookies();
  return getIronSession<SessionData>(cookieStore, sessionOptions);
}

/**
 * 일반 사용자 전용 Server Component 최상단에서 호출합니다.
 * 로그인하지 않았거나 관리자 계정으로 접근하면 /login으로 보냅니다.
 */
export async function requireUserSession() {
  const session = await getSession();
  if (!session.userId || session.role !== "USER") {
    redirect("/login");
  }
  return session as IronSession<SessionData> & {
    userId: string;
    role: "USER";
    name: string;
  };
}

/**
 * 관리자 전용 Server Component 최상단에서 호출합니다.
 */
export async function requireAdminSession() {
  const session = await getSession();
  if (!session.userId || session.role !== "ADMIN") {
    redirect("/admin-login");
  }
  return session as IronSession<SessionData> & {
    userId: string;
    role: "ADMIN";
    name: string;
  };
}
