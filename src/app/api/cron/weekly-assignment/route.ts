import { NextResponse } from "next/server";
import { getAssignmentTargetWeekStart } from "@/lib/duty-week";
import { runWeeklyAssignment } from "@/lib/assignment/run-weekly-assignment";

// Vercel Cron이 매주 금요일 12:00 UTC(=21:00 KST)에 호출한다 (vercel.json 참고).
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 401 });
  }

  const weekStart = getAssignmentTargetWeekStart();
  const result = await runWeeklyAssignment(weekStart);

  return NextResponse.json({ ok: true, result });
}
