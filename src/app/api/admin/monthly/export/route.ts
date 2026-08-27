import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { fetchMonthlyRows, rowsToCsv, type AttendanceFilter } from "@/lib/monthly-report";

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session.userId || session.role !== "ADMIN") {
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  }

  const sp = request.nextUrl.searchParams;
  const now = new Date();
  const year = Number(sp.get("year")) || now.getUTCFullYear();
  const month = Number(sp.get("month")) || now.getUTCMonth() + 1;
  const userId = sp.get("userId") || undefined;
  const gymId = sp.get("gymId") || undefined;
  const attendance = (sp.get("attendance") as AttendanceFilter | null) || undefined;

  const rows = await fetchMonthlyRows({ year, month, userId, gymId, attendance });
  const csv = "﻿" + rowsToCsv(rows);

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="duty-${year}-${String(month).padStart(2, "0")}.csv"`,
    },
  });
}
