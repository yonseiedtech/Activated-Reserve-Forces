import { getSession, json, unauthorized, badRequest } from "@/lib/api-utils";
import { NextRequest } from "next/server";

const NCP_CLIENT_ID = process.env.NAVER_MAP_CLIENT_ID || "";
const NCP_CLIENT_SECRET = process.env.NAVER_MAP_CLIENT_SECRET || "";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();

  const address = req.nextUrl.searchParams.get("address");
  if (!address) return badRequest("address 파라미터가 필요합니다.");

  if (!NCP_CLIENT_ID || !NCP_CLIENT_SECRET) {
    return json({ error: "네이버 API 키가 설정되지 않았습니다." }, 500);
  }

  const res = await fetch(
    `https://naveropenapi.apigw.ntruss.com/map-geocode/v2/geocode?query=${encodeURIComponent(address)}`,
    {
      headers: {
        "X-NCP-APIGW-API-KEY-ID": NCP_CLIENT_ID,
        "X-NCP-APIGW-API-KEY": NCP_CLIENT_SECRET,
      },
    }
  );

  const data = await res.json();
  if (!data.addresses || data.addresses.length === 0) {
    return json({ lat: null, lng: null });
  }

  return json({
    lat: parseFloat(data.addresses[0].y),
    lng: parseFloat(data.addresses[0].x),
  });
}
