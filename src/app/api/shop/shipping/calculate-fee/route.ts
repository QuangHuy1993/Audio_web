import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export const runtime = "nodejs";

type CalculateFeeBody = {
  toDistrictId: number;
  toWardCode: string;
  weight: number;
  serviceTypeId?: number;
};

type GhbFeeResponse = {
  code: number;
  message: string;
  data?: {
    total: number;
    service_fee: number;
    insurance_fee: number;
    pick_station_fee: number;
    coupon_value: number;
  };
};

const GHN_SHIPPING_BASE =
  process.env.GHN_SHIPPING_API_BASE ??
  "https://dev-online-gateway.ghn.vn/shiip/public-api";

export async function POST(request: NextRequest) {
  let body: CalculateFeeBody;
  try {
    body = (await request.json()) as CalculateFeeBody;
  } catch {
    return NextResponse.json(
      { error: "Dữ liệu gửi lên không hợp lệ." },
      { status: 400 },
    );
  }

  const toDistrictId = Number(body.toDistrictId);
  const weight = Number(body.weight);
  const toWardCode = body.toWardCode;

  if (!Number.isInteger(toDistrictId) || toDistrictId <= 0) {
    return NextResponse.json(
      { error: "Mã quận/huyện không hợp lệ." },
      { status: 400 },
    );
  }

  if (!toWardCode || typeof toWardCode !== "string") {
    return NextResponse.json(
      { error: "Mã phường/xã không hợp lệ." },
      { status: 400 },
    );
  }

  if (!Number.isFinite(weight) || weight <= 0) {
    return NextResponse.json(
      { error: "Trọng lượng kiện hàng không hợp lệ." },
      { status: 400 },
    );
  }

  const ghnToken = process.env.GHN_API_TOKEN;
  const ghnShopId = process.env.GHN_SHOP_ID;
  const fromDistrictId = Number(process.env.GHN_FROM_DISTRICT_ID);
  const fromWardCode = process.env.GHN_FROM_WARD_CODE;

  if (!ghnToken || !ghnShopId || !fromDistrictId || !fromWardCode) {
    return NextResponse.json(
      {
        fee: 30000,
        serviceName: "GHN (ước tính)",
        estimatedDays: "3-5 ngày",
        fallback: true,
      },
      { status: 200 },
    );
  }

  const serviceTypeId = body.serviceTypeId ?? 2;
  const feeUrl = `${GHN_SHIPPING_BASE}/v2/shipping-order/fee`;

  try {
    const res = await fetch(feeUrl, {
      method: "POST",
      headers: {
        Token: ghnToken,
        ShopId: ghnShopId,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from_district_id: fromDistrictId,
        from_ward_code: fromWardCode,
        to_district_id: toDistrictId,
        to_ward_code: toWardCode,
        weight,
        service_type_id: serviceTypeId,
      }),
    });

    if (!res.ok) {
      return NextResponse.json(
        {
          fee: 30000,
          serviceName: "GHN (ước tính)",
          estimatedDays: "3-5 ngày",
          fallback: true,
        },
        { status: 200 },
      );
    }

    const data = (await res.json()) as GhbFeeResponse;

    if (!data.data || typeof data.data.total !== "number") {
      return NextResponse.json(
        {
          fee: 30000,
          serviceName: "GHN (ước tính)",
          estimatedDays: "3-5 ngày",
          fallback: true,
        },
        { status: 200 },
      );
    }

    return NextResponse.json({
      fee: data.data.total,
      serviceName:
        serviceTypeId === 5 ? "GHN Nhanh" : "GHN Tiết kiệm",
      estimatedDays: serviceTypeId === 5 ? "1-2 ngày" : "3-5 ngày",
      fallback: false,
    });
  } catch {
    return NextResponse.json(
      {
        fee: 30000,
        serviceName: "GHN (ước tính)",
        estimatedDays: "3-5 ngày",
        fallback: true,
      },
      { status: 200 },
    );
  }
}

