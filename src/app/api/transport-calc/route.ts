import { prisma } from "@/lib/prisma";
import { getSession, json, unauthorized, badRequest } from "@/lib/api-utils";
import { NextRequest } from "next/server";

const NCP_CLIENT_ID = process.env.NEXT_PUBLIC_NAVER_MAP_CLIENT_ID || "";
const NCP_CLIENT_SECRET = process.env.NAVER_MAP_CLIENT_SECRET || "";

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

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();

  const { searchParams } = req.nextUrl;
  const address = searchParams.get("address");
  const unitName = searchParams.get("unitName");

  if (!address || !unitName) {
    return badRequest("address와 unitName 파라미터가 필요합니다.");
  }

  if (!NCP_CLIENT_ID || !NCP_CLIENT_SECRET) {
    return json({ error: "네이버 API 키가 설정되지 않았습니다." }, 500);
  }

  // 1. 부대 좌표 조회
  const unit = await prisma.unit.findUnique({ where: { name: unitName } });
  if (!unit || !unit.latitude || !unit.longitude) {
    return json({ error: "부대 좌표가 등록되지 않았습니다." }, 404);
  }

  // 2. 사용자 주소 → 좌표 변환 (네이버 Geocoding API)
  // 상세주소(동/호수 등)를 제거하여 재시도하는 함수
  const tryGeocode = async (query: string) => {
    const res = await fetch(
      `https://naveropenapi.apigw.ntruss.com/map-geocode/v2/geocode?query=${encodeURIComponent(query)}`,
      { headers: NCP_HEADERS }
    );
    const data = await res.json();
    return data.addresses && data.addresses.length > 0 ? data.addresses[0] : null;
  };

  // 원본 주소로 시도
  let geoResult = await tryGeocode(address);

  // 실패 시 괄호/상세주소 제거 후 재시도
  if (!geoResult) {
    const simplified = address
      .replace(/\(.*?\)/g, "")           // 괄호 안 내용 제거
      .replace(/\d+-\d+$/, "")           // 끝의 동-호수 제거
      .replace(/\s+\d+동\s*\d*호?$/, "") // "101동 302호" 패턴 제거
      .trim();
    if (simplified && simplified !== address) {
      geoResult = await tryGeocode(simplified);
    }
  }

  if (!geoResult) {
    return json({ error: "입력된 주소를 찾을 수 없습니다. 도로명 또는 지번 주소를 정확히 입력해주세요." }, 400);
  }
  const originX = geoResult.x; // 경도
  const originY = geoResult.y; // 위도

  // 3. 네이버 Directions 5 API 호출
  const navRes = await fetch(
    `https://naveropenapi.apigw.ntruss.com/map-direction-15/v1/driving?start=${originX},${originY}&goal=${unit.longitude},${unit.latitude}`,
    { headers: NCP_HEADERS }
  );
  const navData = await navRes.json();

  if (navData.code !== 0 || !navData.route?.traoptimal?.[0]) {
    return json({ error: "경로를 조회할 수 없습니다." }, 400);
  }

  const route = navData.route.traoptimal[0];
  const summary = route.summary;
  const distance_m = summary.distance;
  const km = Math.round(distance_m / 1000);
  const tollFare = summary.tollFare || 0;
  const hasToll = tollFare > 0;

  const calc = calcTransport(km, hasToll);

  // 경로 좌표 추출 (path: [[lng, lat], ...])
  const routeCoords: Array<{ lat: number; lng: number }> = [];
  if (route.path) {
    for (const point of route.path) {
      routeCoords.push({ lng: point[0], lat: point[1] });
    }
  }

  return json({
    distance_m,
    km,
    hasToll,
    tollFare,
    ...calc,
    origin: { lat: parseFloat(originY), lng: parseFloat(originX) },
    destination: { lat: unit.latitude, lng: unit.longitude },
    routeCoords,
  });
}
