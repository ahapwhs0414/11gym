import { NextRequest, NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import { sessionOptions, type SessionData } from "@/lib/session";

// 로그인 없이 접근 가능한 경로
const PUBLIC_PATHS = ["/login", "/admin-login"];

// /admin/* 은 관리자 전용, 그 외 보호 경로는 일반 사용자 전용으로 취급합니다.
function isAdminPath(pathname: string) {
  return pathname.startsWith("/admin");
}

function isProtectedPath(pathname: string) {
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) return false;
  if (pathname.startsWith("/api/auth")) return false; // 로그인/로그아웃 API는 별도
  if (pathname.startsWith("/_next") || pathname.startsWith("/favicon")) return false;
  return true;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (!isProtectedPath(pathname)) {
    return NextResponse.next();
  }

  const response = NextResponse.next();
  const session = await getIronSession<SessionData>(request, response, sessionOptions);

  const wantsAdmin = isAdminPath(pathname);

  if (!session.userId) {
    const loginPath = wantsAdmin ? "/admin-login" : "/login";
    return NextResponse.redirect(new URL(loginPath, request.url));
  }

  if (wantsAdmin && session.role !== "ADMIN") {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (!wantsAdmin && session.role !== "USER" && pathname !== "/") {
    return NextResponse.redirect(new URL("/admin-login", request.url));
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * 정적 파일(_next/static, _next/image, favicon 등)을 제외한 모든 경로에 적용
     */
    "/((?!_next/static|_next/image|favicon.ico|manifest.json|icons).*)",
  ],
};
