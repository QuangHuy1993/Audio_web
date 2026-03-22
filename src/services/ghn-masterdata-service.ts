import "server-only";

type GhnProvince = {
  ProvinceID: number;
  ProvinceName: string;
  NameExtension?: string[];
};

type GhnDistrict = {
  DistrictID: number;
  ProvinceID: number;
  DistrictName: string;
  Code?: string;
  NameExtension?: string[];
};

type GhnWard = {
  WardCode: string;
  WardName: string;
  DistrictID: number;
};

type GhnBaseResponse<T> = {
  code: number;
  message: string;
  data?: T;
};

const GHN_API_BASE =
  process.env.GHN_API_BASE ??
  "https://dev-online-gateway.ghn.vn/shiip/public-api/master-data";

// Một số mapping tĩnh cho các tỉnh/thành phổ biến để tránh sai lệch khi resolve từ GHN
// Giá trị ProvinceID dựa trên tài liệu GHN:
// - 201: Hà Nội
// - 202: Hồ Chí Minh
const STATIC_GHN_PROVINCE_MAP: Record<string, number> = {
  "ha noi": 201,
  "ho chi minh": 202,
};

let cachedProvinces: GhnProvince[] | null = null;
let cachedDistricts: GhnDistrict[] | null = null;
const cachedDistrictsByProvince: Record<number, GhnDistrict[]> = {};
const cachedWardsByDistrict: Record<number, GhnWard[]> = {};

function getGhnHeaders(): HeadersInit | null {
  const token = process.env.GHN_API_TOKEN;
  const shopId = process.env.GHN_SHOP_ID;

  if (!token || !shopId) {
    return null;
  }

  return {
    Token: token,
    ShopId: shopId,
    "Content-Type": "application/json",
  };
}

function normalizeVietnameseName(input: string | null | undefined): string {
  if (!input) {
    return "";
  }

  return input
    .replace(/[Đđ]/g, "d")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(
      /\b(thanh pho|tp|quan|q\.?|huyen|h\.?|thi xa|thi tran|phuong|p\.?|xa)\b/g,
      " ",
    )
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function fetchAllProvinces(): Promise<GhnProvince[]> {
  if (cachedProvinces) {
    return cachedProvinces;
  }

  const headers = getGhnHeaders();
  if (!headers) {
    console.warn("[GHN][MasterData] missing headers, skip province fetch", {
      hasToken: Boolean(process.env.GHN_API_TOKEN),
      hasShopId: Boolean(process.env.GHN_SHOP_ID),
    });
    return [];
  }

  try {
    const url = `${GHN_API_BASE}/province`;
    console.log("[GHN][MasterData] fetching provinces", { url });

    const res = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify({}),
      cache: "force-cache",
    });

    if (!res.ok) {
      console.error("[GHN][MasterData] province fetch failed", {
        url,
        status: res.status,
        statusText: res.statusText,
      });
      return [];
    }

    const json = (await res.json()) as GhnBaseResponse<GhnProvince[]>;
    if (!Array.isArray(json.data)) {
      return [];
    }

    cachedProvinces = json.data;
    return cachedProvinces;
  } catch (error) {
    console.error("[GHN][MasterData] province fetch error", error);
    return [];
  }
}

async function fetchAllDistricts(): Promise<GhnDistrict[]> {
  if (cachedDistricts) {
    return cachedDistricts;
  }

  const headers = getGhnHeaders();
  if (!headers) {
    console.warn("[GHN][MasterData] missing headers, skip district fetch", {
      hasToken: Boolean(process.env.GHN_API_TOKEN),
      hasShopId: Boolean(process.env.GHN_SHOP_ID),
    });
    return [];
  }

  try {
    const url = `${GHN_API_BASE}/district`;
    console.log("[GHN][MasterData] fetching districts", { url });

    const res = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify({}),
      cache: "force-cache",
    });

    if (!res.ok) {
      console.error("[GHN][MasterData] district fetch failed", {
        url,
        status: res.status,
        statusText: res.statusText,
      });
      return [];
    }

    const json = (await res.json()) as GhnBaseResponse<GhnDistrict[]>;
    if (!Array.isArray(json.data)) {
      return [];
    }

    cachedDistricts = json.data;
    return cachedDistricts;
  } catch (error) {
    console.error("[GHN][MasterData] district fetch error", error);
    return [];
  }
}

async function fetchDistrictsByProvinceId(
  provinceId: number | null,
): Promise<GhnDistrict[]> {
  if (provinceId && cachedDistrictsByProvince[provinceId]) {
    return cachedDistrictsByProvince[provinceId];
  }

  const headers = getGhnHeaders();
  if (!headers) {
    return [];
  }

  // Nếu không có provinceId hợp lệ, fallback về fetch toàn bộ như hiện tại
  if (!provinceId || provinceId <= 0) {
    return fetchAllDistricts();
  }

  try {
    const url = `${GHN_API_BASE}/district`;
    console.log("[GHN][MasterData] fetching districts by province", {
      url,
      provinceId,
    });

    const res = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify({ province_id: provinceId }),
      cache: "force-cache",
    });

    if (!res.ok) {
      console.error("[GHN][MasterData] district-by-province fetch failed", {
        url,
        status: res.status,
        statusText: res.statusText,
        provinceId,
      });
      return [];
    }

    const json = (await res.json()) as GhnBaseResponse<GhnDistrict[]>;
    if (!Array.isArray(json.data)) {
      return [];
    }

    cachedDistrictsByProvince[provinceId] = json.data;
    return cachedDistrictsByProvince[provinceId];
  } catch (error) {
    console.error("[GHN][MasterData] district-by-province fetch error", {
      error,
      provinceId,
    });
    return [];
  }
}

async function fetchWardsByDistrict(districtId: number): Promise<GhnWard[]> {
  if (cachedWardsByDistrict[districtId]) {
    return cachedWardsByDistrict[districtId];
  }

  const headers = getGhnHeaders();
  if (!headers) {
    return [];
  }

  try {
    const url = `${GHN_API_BASE}/ward`;
    console.log("[GHN][MasterData] fetching wards", { url, districtId });

    const res = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify({ district_id: districtId }),
      cache: "force-cache",
    });

    if (!res.ok) {
      console.error("[GHN][MasterData] ward fetch failed", {
        url,
        status: res.status,
        statusText: res.statusText,
        districtId,
      });
      return [];
    }

    const json = (await res.json()) as GhnBaseResponse<GhnWard[]>;
    if (!Array.isArray(json.data)) {
      return [];
    }

    cachedWardsByDistrict[districtId] = json.data;
    return cachedWardsByDistrict[districtId];
  } catch (error) {
    console.error("[GHN][MasterData] ward fetch error", { error, districtId });
    return [];
  }
}

async function resolveGhnProvinceId(
  provinceName: string | null | undefined,
): Promise<number | null> {
  const normalizedProvince = normalizeVietnameseName(provinceName);

  if (!normalizedProvince) {
    return null;
  }

  const staticMapped = STATIC_GHN_PROVINCE_MAP[normalizedProvince];
  if (staticMapped) {
    console.log("[GHN][Resolve] province resolved via static map", {
      normalizedProvince,
      provinceId: staticMapped,
    });
    return staticMapped;
  }

  const provinces = await fetchAllProvinces();
  if (!provinces.length) {
    return null;
  }

  for (const province of provinces) {
    const baseName = normalizeVietnameseName(province.ProvinceName);

    if (
      baseName &&
      (baseName === normalizedProvince ||
        baseName.includes(normalizedProvince) ||
        normalizedProvince.includes(baseName))
    ) {
      return province.ProvinceID;
    }

    if (Array.isArray(province.NameExtension)) {
      for (const ext of province.NameExtension) {
        const normalizedExt = normalizeVietnameseName(ext);

        if (
          normalizedExt &&
          (normalizedExt === normalizedProvince ||
            normalizedExt.includes(normalizedProvince) ||
            normalizedProvince.includes(normalizedExt))
        ) {
          return province.ProvinceID;
        }
      }
    }
  }

  console.warn("[GHN][Resolve] province not found", {
    normalizedProvince,
  });

  return null;
}

export async function resolveGhnDistrictAndWard(params: {
  districtName: string;
  wardName?: string | null;
  provinceName?: string | null;
}): Promise<{ ghnDistrictId: number; ghnWardCode: string | null } | null> {
  const normalizedDistrict = normalizeVietnameseName(params.districtName);
  const normalizedWard = normalizeVietnameseName(params.wardName);

  if (!normalizedDistrict) {
    console.warn("[GHN][Resolve] empty normalized district", {
      rawDistrict: params.districtName,
    });
    return null;
  }
  const provinceId = await resolveGhnProvinceId(params.provinceName);

  const districts = await fetchDistrictsByProvinceId(provinceId);
  if (!districts.length) {
    console.warn("[GHN][Resolve] no districts loaded", {
      provinceId,
      rawProvince: params.provinceName,
    });
    return null;
  }

  const matchedDistrict = districts.find((item) => {
    const itemDistrict = normalizeVietnameseName(item.DistrictName);

    if (!itemDistrict) {
      return false;
    }

    const districtMatches =
      itemDistrict === normalizedDistrict ||
      itemDistrict.includes(normalizedDistrict) ||
      normalizedDistrict.includes(itemDistrict);

    return districtMatches;
  });

  if (!matchedDistrict) {
    console.warn("[GHN][Resolve] district not found", {
      normalizedDistrict,
      provinceId,
      rawProvince: params.provinceName,
    });
    return null;
  }

  if (!normalizedWard) {
    const result = {
      ghnDistrictId: matchedDistrict.DistrictID,
      ghnWardCode: null,
    };
    console.log("[GHN][Resolve] district matched, no ward", {
      matchedDistrict,
      result,
    });
    return result;
  }

  const wards = await fetchWardsByDistrict(matchedDistrict.DistrictID);
  if (!wards.length) {
    const result = {
      ghnDistrictId: matchedDistrict.DistrictID,
      ghnWardCode: null,
    };
    console.log("[GHN][Resolve] no wards for district, fallback", {
      matchedDistrict,
      result,
    });
    return result;
  }

  const matchedWard = wards.find((ward) => {
    const itemWard = normalizeVietnameseName(ward.WardName);
    return itemWard === normalizedWard;
  });

  if (!matchedWard) {
    const result = {
      ghnDistrictId: matchedDistrict.DistrictID,
      ghnWardCode: null,
    };
    console.log("[GHN][Resolve] ward not found, fallback", {
      matchedDistrict,
      normalizedWard,
      result,
    });
    return result;
  }

  const result = {
    ghnDistrictId: matchedDistrict.DistrictID,
    ghnWardCode: matchedWard.WardCode,
  };
  console.log("[GHN][Resolve] district + ward matched", {
    matchedDistrict,
    matchedWard,
    result,
  });
  return result;
}

