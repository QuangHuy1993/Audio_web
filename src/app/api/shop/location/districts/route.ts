import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import type { DistrictOption } from "@/types/location";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const provinceCodeParam = searchParams.get("provinceCode");

  const provinceCode = provinceCodeParam ? Number(provinceCodeParam) : NaN;

  if (!Number.isInteger(provinceCode) || provinceCode <= 0) {
    return NextResponse.json(
      { error: "Mã tỉnh/thành phố không hợp lệ." },
      { status: 400 },
    );
  }

  // Sử dụng endpoint v1 ổn định trả về province + districts[]
  const upstreamUrl = `https://provinces.open-api.vn/api/p/${provinceCode}?depth=2`;

  try {
    const res = await fetch(upstreamUrl, {
      next: { revalidate: 60 * 60 * 24 * 7 },
    });

    if (!res.ok) {
      console.error("[Location][Districts] Upstream error", {
        status: res.status,
        statusText: res.statusText,
      });

      return NextResponse.json(
        { error: "Không thể tải danh sách quận/huyện." },
        { status: 502 },
      );
    }

    const raw = (await res.json()) as unknown;

    let districtsRaw: unknown[] = [];

    if (Array.isArray(raw)){ 
      const first = raw[0] as { districts?: unknown[] } | undefined;

      if (first && typeof first === "object" && "districts" in first) {
        const nested = first.districts;
        if (Array.isArray(nested)) {
          districtsRaw = nested;
        }
      } else {
        // Upstream trả về trực tiếp mảng quận/huyện (không bọc trong districts)
        districtsRaw = raw;
      }
    } else if (raw && typeof raw === "object" && "districts" in raw) {
      const obj = raw as { districts?: unknown[] };
      if (obj.districts && Array.isArray(obj.districts)) {
        districtsRaw = obj.districts;
      }
    } else {
      console.error("[Location][Districts] Unexpected upstream payload shape", {
        url: upstreamUrl,
        type: typeof raw,
      });
    }

    const districts: DistrictOption[] = districtsRaw.map((item) => {
      const district = item as Partial<DistrictOption> & {
        division_type?: string;
      };
      return {
        code: Number(district.code),
        name: district.name ?? "",
        codename: district.codename ?? "",
        division_type: district.division_type ?? "",
      };
    });

    return NextResponse.json(districts);
  } catch (error) {
    console.error("[Location][Districts] Failed to fetch districts", error, {
      url: request.url,
    });

    return NextResponse.json(
      { error: "Không thể tải danh sách quận/huyện." },
      { status: 500 },
    );
  }
}

