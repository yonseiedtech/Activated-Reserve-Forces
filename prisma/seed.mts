import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

async function main() {
  const prisma = new PrismaClient();

  try {
    // 관리자 계정
    const adminPassword = await bcrypt.hash("admin1234", 10);
    const admin = await prisma.user.upsert({
      where: { email: "admin@reserve.mil" },
      update: {},
      create: {
        name: "시스템관리자",
        email: "admin@reserve.mil",
        password: adminPassword,
        role: "ADMIN",
      },
    });

    // 행정담당자 계정
    const managerPassword = await bcrypt.hash("manager1234", 10);
    const manager = await prisma.user.upsert({
      where: { email: "manager@reserve.mil" },
      update: {},
      create: {
        name: "김행정",
        email: "manager@reserve.mil",
        password: managerPassword,
        role: "MANAGER",
      },
    });

    // 급식담당자 계정
    const cookPassword = await bcrypt.hash("cook1234", 10);
    await prisma.user.upsert({
      where: { email: "cook@reserve.mil" },
      update: {},
      create: {
        name: "박급식",
        email: "cook@reserve.mil",
        password: cookPassword,
        role: "COOK",
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
    const reservistPassword = await bcrypt.hash("reservist1234", 10);
    const reservistNames = ["이준호", "박민수", "최영철", "정태웅", "한성민"];
    for (let i = 0; i < reservistNames.length; i++) {
      await prisma.user.create({
        data: {
          name: reservistNames[i],
          email: `reservist${i + 1}@reserve.mil`,
          password: reservistPassword,
          role: "RESERVIST",
          rank: "병장",
          serviceNumber: `22-7600${i + 1}`,
          unit: "00사단 00연대",
          phone: `010-1234-${String(i + 1).padStart(4, "0")}`,
          batchId: batch1.id,
        },
      });
    }

    // 2차수 대상자
    const reservistNames2 = ["송재현", "유승호", "오지훈"];
    for (let i = 0; i < reservistNames2.length; i++) {
      await prisma.user.create({
        data: {
          name: reservistNames2[i],
          email: `reservist${i + 6}@reserve.mil`,
          password: reservistPassword,
          role: "RESERVIST",
          rank: "상병",
          serviceNumber: `23-7600${i + 1}`,
          unit: "00사단 00연대",
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

    console.log("시드 데이터 생성 완료");
    console.log("─────────────────────────");
    console.log("관리자: admin@reserve.mil / admin1234");
    console.log("행정담당자: manager@reserve.mil / manager1234");
    console.log("급식담당자: cook@reserve.mil / cook1234");
    console.log("대상자: reservist1@reserve.mil ~ reservist8@reserve.mil / reservist1234");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(console.error);
