import { prisma } from "@/lib/prisma";
import { getSession, json, unauthorized, forbidden, badRequest } from "@/lib/api-utils";
import { NextRequest } from "next/server";

const NCP_CLIENT_ID = (process.env.NEXT_PUBLIC_NAVER_MAP_CLIENT_ID || "").trim();
const NCP_CLIENT_SECRET = (process.env.NAVER_MAP_CLIENT_SECRET || "").trim();

const NCP_HEADERS = {
  "X-NCP-APIGW-API-KEY-ID": NCP_CLIENT_ID,
  "X-NCP-APIGW-API-KEY": NCP_CLIENT_SECRET,
};

function calcTransport(km: number, hasToll: boolean) {
  if (km <= 30) return { total: 4000, fuel: 0, toll: 0 };
  const fuel_raw = km * (1486 / 13.3);
  const toll_raw = hasToll ? 900 + 44.3 * km : 0;
  const total = Math.floor((fuel_raw + toll_raw) / 10) * 10;
  return { total, fuel: Math.round(fuel_raw), toll: Math.round(toll_raw) };
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!["ADMIN", "MANAGER"].includes(session.user.role)) return forbidden();

  const body = await req.json();
  const { batchId } = body as { batchId: string };

  if (!batchId) return badRequest("batchId가 필요합니다.");

  if (!NCP_CLIENT_ID || !NCP_CLIENT_SECRET) {
    return json({ error: "네이버 API 키가 설정되지 않았습니다." }, 500);
  }

  // 1. 좌표가 있는 첫 번째 Unit 조회
  const unit = await prisma.unit.findFirst({
    where: { latitude: { not: null }, longitude: { not: null } },
  });
  if (!unit || !unit.latitude || !unit.longitude) {
    return json({ error: "좌표가 등록된 부대가 없습니다." }, 400);
  }

  // 2. 차수 참가자 조회 (주소 포함)
  const batchUsers = await prisma.batchUser.findMany({
    where: { batchId },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          rank: true,
          address: true,
          addressDetail: true,
        },
      },
    },
  });

  if (batchUsers.length === 0) {
    return json({ error: "해당 차수에 참가자가 없습니다." }, 400);
  }

  // 3. 기존 저장된 교통비 조회
  const existingAllowances = await prisma.userTransportAllowance.findMany({
    where: { batchId },
  });
  const savedMap = new Map(existingAllowances.map((a) => [a.userId, a.amount]));

  // 4. 각 인원별 계산
  const results = [];
  for (const bu of batchUsers) {
    const user = bu.user;
    const fullAddress = user.address
      ? `${user.address}${user.addressDetail ? " " + user.addressDetail : ""}`
      : null;

    if (!fullAddress) {
      results.push({
        userId: user.id,
        name: user.name,
        rank: user.rank,
        address: null,
        distanceKm: null,
        calculatedAmount: null,
        savedAmount: savedMap.get(user.id) ?? null,
        status: "NO_ADDRESS" as const,
      });
      continue;
    }

    try {
      // Geocoding (원본 주소로 시도 → 실패 시 간소화 후 재시도)
      const tryGeocode = async (query: string) => {
        const res = await fetch(
          `https://naveropenapi.apigw.ntruss.com/map-geocode/v2/geocode?query=${encodeURIComponent(query)}`,
          { headers: NCP_HEADERS }
        );
        const data = await res.json();
        return data.addresses && data.addresses.length > 0 ? data.addresses[0] : null;
      };

      let geoResult = await tryGeocode(user.address!);
      if (!geoResult) {
        // 상세주소/괄호 제거 후 재시도
        const simplified = user.address!
          .replace(/\(.*?\)/g, "")
          .replace(/\d+-\d+$/, "")
          .replace(/\s+\d+동\s*\d*호?$/, "")
          .trim();
        if (simplified && simplified !== user.address) {
          geoResult = await tryGeocode(simplified);
        }
      }

      if (!geoResult) {
        results.push({
          userId: user.id,
          name: user.name,
          rank: user.rank,
          address: fullAddress,
          distanceKm: null,
          calculatedAmount: null,
          savedAmount: savedMap.get(user.id) ?? null,
          status: "GEO_FAIL" as const,
        });
        continue;
      }

      const originX = geoResult.x;
      const originY = geoResult.y;

      // Directions
      const navRes = await fetch(
        `https://naveropenapi.apigw.ntruss.com/map-direction-15/v1/driving?start=${originX},${originY}&goal=${unit.longitude},${unit.latitude}`,
        { headers: NCP_HEADERS }
      );
      const navData = await navRes.json();

      if (navData.code !== 0 || !navData.route?.traoptimal?.[0]) {
        results.push({
          userId: user.id,
          name: user.name,
          rank: user.rank,
          address: fullAddress,
          distanceKm: null,
          calculatedAmount: null,
          savedAmount: savedMap.get(user.id) ?? null,
          status: "ROUTE_FAIL" as const,
        });
        continue;
      }

      const summary = navData.route.traoptimal[0].summary;
      const km = Math.round(summary.distance / 1000);
      const hasToll = (summary.tollFare || 0) > 0;
      const calc = calcTransport(km, hasToll);

      results.push({
        userId: user.id,
        name: user.name,
        rank: user.rank,
        address: fullAddress,
        distanceKm: km,
        calculatedAmount: calc.total,
        savedAmount: savedMap.get(user.id) ?? null,
        status: "OK" as const,
      });
    } catch {
      results.push({
        userId: user.id,
        name: user.name,
        rank: user.rank,
        address: fullAddress,
        distanceKm: null,
        calculatedAmount: null,
        savedAmount: savedMap.get(user.id) ?? null,
        status: "ERROR" as const,
      });
    }
  }

  return json({ unitName: unit.name, results });
}
