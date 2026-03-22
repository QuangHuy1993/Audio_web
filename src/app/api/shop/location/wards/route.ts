import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import type { WardOption } from "@/types/location";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const districtCodeParam = searchParams.get("districtCode");

  const districtCode = districtCodeParam ? Number(districtCodeParam) : NaN;

  if (!Number.isInteger(districtCode) || districtCode <= 0) {
    return NextResponse.json(
      { error: "Mã quận/huyện không hợp lệ." },
      { status: 400 },
    );
  }

  // Sử dụng endpoint không version (v1 mặc định) tương tự như API quận/huyện,
  // trả về object chứa mảng wards.
  const upstreamUrl = `https://provinces.open-api.vn/api/d/${districtCode}?depth=2`;

  try {
    const res = await fetch(upstreamUrl, {
      next: { revalidate: 60 * 60 * 24 * 7 },
    });

    if (!res.ok) {
      console.error("[Location][Wards] Upstream error", {
        status: res.status,
        statusText: res.statusText,
      });

      return NextResponse.json(
        { error: "Không thể tải danh sách phường/xã." },
        { status: 502 },
      );
    }

    const data = (await res.json()) as {
      wards: WardOption[];
    };

    return NextResponse.json(data.wards ?? []);
  } catch (error) {
    console.error("[Location][Wards] Failed to fetch wards", error, {
      url: request.url,
    });

    return NextResponse.json(
      { error: "Không thể tải danh sách phường/xã." },
      { status: 500 },
    );
  }
}

