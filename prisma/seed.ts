import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  // ---------- 헬스장 초기 데이터 ----------
  await prisma.gym.upsert({
    where: { name: "힘레븐1" },
    update: {},
    create: { name: "힘레븐1" },
  });
  await prisma.gym.upsert({
    where: { name: "힘레븐2" },
    update: {},
    create: { name: "힘레븐2" },
  });
  console.log("✔ 헬스장(힘레븐1, 힘레븐2) 준비 완료");

  // ---------- 체크리스트 초기 데이터 ----------
  const checklistItems = [
    "기구 윤활하기",
    "바닥 청소하기",
    "분실물 모아두기",
    "쓰레기 버리기",
  ];
  for (let i = 0; i < checklistItems.length; i++) {
    const name = checklistItems[i];
    const exists = await prisma.checklistItem.findFirst({ where: { name } });
    if (!exists) {
      await prisma.checklistItem.create({
        data: { name, sortOrder: i, required: true },
      });
    }
  }
  console.log("✔ 체크리스트 기본 항목 준비 완료");

  // ---------- 관리자 계정 ----------
  const adminName = process.env.SEED_ADMIN_NAME ?? "admin";
  const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? "changeme123!";

  const existingAdmin = await prisma.user.findFirst({
    where: { name: adminName, role: "ADMIN" },
  });

  if (!existingAdmin) {
    const pinHash = await bcrypt.hash(adminPassword, 10);
    await prisma.user.create({
      data: {
        name: adminName,
        pinHash,
        role: "ADMIN",
        status: "ACTIVE",
      },
    });
    console.log(
      `✔ 관리자 계정 생성됨 → 아이디: ${adminName} / 비밀번호: ${adminPassword}`
    );
    console.log("  ⚠ 반드시 최초 로그인 후 비밀번호를 변경하세요 (Phase 2에서 기능 추가 예정).");
  } else {
    console.log("… 관리자 계정이 이미 존재합니다. 건너뜁니다.");
  }

  // ---------- 테스트용 일반 사용자 (로컬 개발/QA용, 운영 시 삭제 권장) ----------
  if (process.env.SEED_WITH_TEST_USER === "true") {
    const testUserName = "테스트유저";
    const existingUser = await prisma.user.findFirst({
      where: { name: testUserName, role: "USER" },
    });
    if (!existingUser) {
      const pinHash = await bcrypt.hash("1234", 10);
      await prisma.user.create({
        data: {
          name: testUserName,
          pinHash,
          role: "USER",
          status: "ACTIVE",
          gymPreference: "ANY",
        },
      });
      console.log(`✔ 테스트 사용자 생성됨 → 이름: ${testUserName} / PIN: 1234`);
    }
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
