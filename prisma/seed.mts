import { config } from "dotenv";
config({ path: ".env.local" });
config(); // fallback to .env
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

async function main() {
  const prisma = new PrismaClient({
    datasourceUrl: process.env.POSTGRES_PRISMA_URL || process.env.DATABASE_URL,
  });

  try {
    // 부대 정보
    await prisma.unit.upsert({
      where: { name: "00사단 00연대" },
      update: {},
      create: { name: "00사단 00연대", description: "예비군 훈련 주관부대" },
    });
    await prisma.unit.upsert({
      where: { name: "00사단 00대대" },
      update: {},
      create: { name: "00사단 00대대", description: "예비군 훈련 지원부대" },
    });

    // 관리자 계정
    const adminPassword = await bcrypt.hash("admin1234", 10);
    const admin = await prisma.user.upsert({
      where: { username: "admin" },
      update: {},
      create: {
        name: "시스템관리자",
        username: "admin",
        email: "admin@reserve.mil",
        password: adminPassword,
        role: "ADMIN",
        position: "체계관리자",
      },
    });

    // 행정담당자 계정
    const managerPassword = await bcrypt.hash("manager1234", 10);
    const manager = await prisma.user.upsert({
      where: { username: "manager" },
      update: {},
      create: {
        name: "김행정",
        username: "manager",
        email: "manager@reserve.mil",
        password: managerPassword,
        role: "MANAGER",
        position: "행정담당자",
      },
    });

    // 급식담당자 계정
    const cookPassword = await bcrypt.hash("cook1234", 10);
    await prisma.user.upsert({
      where: { username: "cook" },
      update: {},
      create: {
        name: "박급식",
        username: "cook",
        email: "cook@reserve.mil",
        password: cookPassword,
        role: "COOK",
        position: "급식담당자",
      },
    });

    // 차수 생성
    const batch1 = await prisma.batch.create({
      data: {
        name: "2026년 1차수",
        year: 2026,
        number: 1,
        startDate: new Date("2026-03-02"),
        endDate: new Date("2026-03-06"),
        status: "PLANNED",
      },
    });

    const batch2 = await prisma.batch.create({
      data: {
        name: "2026년 2차수",
        year: 2026,
        number: 2,
        startDate: new Date("2026-03-16"),
        endDate: new Date("2026-03-20"),
        status: "PLANNED",
      },
    });

    // 대상자 계정 (1차수)
    // 초기 비밀번호: 생년월일 6자리 (예: 980315)
    const reservistNames = ["이준호", "박민수", "최영철", "정태웅", "한성민"];
    const birthDates = ["1998-03-15", "1997-07-22", "1999-01-08", "1998-11-30", "1997-05-12"];

    const birthDateToPassword = (bd: string) => {
      const d = new Date(bd);
      const yy = String(d.getFullYear()).slice(2);
      const mm = String(d.getMonth() + 1).padStart(2, "0");
      const dd = String(d.getDate()).padStart(2, "0");
      return `${yy}${mm}${dd}`;
    };

    const batch1Users = [];
    for (let i = 0; i < reservistNames.length; i++) {
      const pw = await bcrypt.hash(birthDateToPassword(birthDates[i]), 10);
      const u = await prisma.user.create({
        data: {
          name: reservistNames[i],
          username: `reservist${i + 1}`,
          email: `reservist${i + 1}@reserve.mil`,
          password: pw,
          role: "RESERVIST",
          rank: "병장",
          serviceNumber: `22-7600${i + 1}`,
          unit: "00사단 00연대",
          position: "상비예비군",
          birthDate: new Date(birthDates[i]),
          phone: `010-1234-${String(i + 1).padStart(4, "0")}`,
          batchId: batch1.id,
        },
      });
      batch1Users.push(u);
    }

    // 2차수 대상자
    const reservistNames2 = ["송재현", "유승호", "오지훈"];
    const birthDates2 = ["2000-02-14", "1999-08-25", "2000-06-03"];
    for (let i = 0; i < reservistNames2.length; i++) {
      const pw = await bcrypt.hash(birthDateToPassword(birthDates2[i]), 10);
      await prisma.user.create({
        data: {
          name: reservistNames2[i],
          username: `reservist${i + 6}`,
          email: `reservist${i + 6}@reserve.mil`,
          password: pw,
          role: "RESERVIST",
          rank: "상병",
          serviceNumber: `23-7600${i + 1}`,
          unit: "00사단 00연대",
          position: "상비예비군",
          birthDate: new Date(birthDates2[i]),
          phone: `010-5678-${String(i + 1).padStart(4, "0")}`,
          batchId: batch2.id,
        },
      });
    }

    // 훈련 일정 (1차수)
    const trainingData = [
      { title: "입영 및 편성", type: "기타", date: "2026-03-02", start: "09:00", end: "12:00" },
      { title: "사격 훈련", type: "사격", date: "2026-03-03", start: "08:00", end: "17:00" },
      { title: "화생방 훈련", type: "화생방", date: "2026-03-04", start: "09:00", end: "16:00" },
      { title: "전술 훈련", type: "전술", date: "2026-03-05", start: "08:00", end: "17:00" },
      { title: "체력 측정 및 퇴영", type: "체력", date: "2026-03-06", start: "08:00", end: "12:00" },
    ];

    for (const t of trainingData) {
      await prisma.training.create({
        data: {
          title: t.title,
          type: t.type,
          date: new Date(t.date),
          startTime: t.start,
          endTime: t.end,
          location: "00사단 훈련장",
          batchId: batch1.id,
          instructorId: manager.id,
        },
      });
    }

    // GPS 위치 등록 (샘플)
    await prisma.gpsLocation.create({
      data: {
        name: "00사단 위병소",
        latitude: 37.5665,
        longitude: 126.978,
        radius: 200,
        isActive: true,
      },
    });

    // 공지사항
    await prisma.notice.create({
      data: {
        title: "2026년 상비예비군 소집훈련 안내",
        content: "2026년 상비예비군 소집훈련 일정을 안내드립니다.\n\n1차수: 3월 2일 ~ 3월 6일\n2차수: 3월 16일 ~ 3월 20일\n\n준비물: 신분증, 개인 세면도구\n집합장소: 00사단 위병소 앞",
        isPinned: true,
        authorId: admin.id,
      },
    });

    // 모바일 신분증 샘플 (1차수 1번 대상자 - 승인됨)
    await prisma.mobileIdCard.create({
      data: {
        userId: batch1Users[0].id,
        uniqueNumber: "RES-2026-00001",
        validFrom: batch1.startDate,
        validUntil: batch1.endDate,
        isApproved: true,
        approvedAt: new Date(),
        approvedById: admin.id,
      },
    });

    // 모바일 신분증 샘플 (1차수 2번 대상자 - 승인 대기)
    await prisma.mobileIdCard.create({
      data: {
        userId: batch1Users[1].id,
        uniqueNumber: "RES-2026-00002",
        validFrom: batch1.startDate,
        validUntil: batch1.endDate,
      },
    });

    console.log("시드 데이터 생성 완료");
    console.log("─────────────────────────");
    console.log("[관리자 탭] 아이디로 로그인");
    console.log("  관리자: admin / admin1234");
    console.log("  행정담당자: manager / manager1234");
    console.log("  급식담당자: cook / cook1234");
    console.log("─────────────────────────");
    console.log("[훈련대상자 탭] 군번으로 로그인 (비밀번호: 생년월일 6자리)");
    console.log("  이준호: 22-76001 / 980315");
    console.log("  박민수: 22-76002 / 970722");
    console.log("  최영철: 22-76003 / 990108");
    console.log("  정태웅: 22-76004 / 981130");
    console.log("  한성민: 22-76005 / 970512");
    console.log("  송재현: 23-76001 / 000214");
    console.log("  유승호: 23-76002 / 990825");
    console.log("  오지훈: 23-76003 / 000603");
    console.log("  - 이준호(22-76001): 모바일 신분증 승인됨");
    console.log("  - 박민수(22-76002): 모바일 신분증 승인 대기");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(console.error);
