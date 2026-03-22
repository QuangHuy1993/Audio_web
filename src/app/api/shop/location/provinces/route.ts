import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import type { ProvinceOption } from "@/types/location";

export const runtime = "nodejs";

const PROVINCES_API_URL = "https://provinces.open-api.vn/api/v2/p/";

export async function GET(request: NextRequest) {
  try {
    const res = await fetch(PROVINCES_API_URL, {
      next: { revalidate: 60 * 60 * 24 * 7 },
    });

    if (!res.ok) {
      console.error("[Location][Provinces] Upstream error", {
        status: res.status,
        statusText: res.statusText,
      });

      return NextResponse.json(
        { error: "Không thể tải danh sách tỉnh/thành phố." },
        { status: 502 },
      );
    }

    const data = (await res.json()) as ProvinceOption[];
    return NextResponse.json(data);
  } catch (error) {
    console.error("[Location][Provinces] Failed to fetch provinces", error, {
      url: request.url,
    });

    return NextResponse.json(
      { error: "Không thể tải danh sách tỉnh/thành phố." },
      { status: 500 },
    );
  }
}

