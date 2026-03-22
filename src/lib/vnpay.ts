import crypto from "crypto";
import querystring from "querystring";

type VnpayConfig = {
  tmnCode: string;
  hashSecret: string;
  baseUrl: string;
  returnUrl: string;
};

export type VnpayPaymentParams = {
  vnp_TxnRef: string;
  vnp_Amount: number;
  vnp_OrderInfo: string;
  vnp_IpAddr: string;
  vnp_ExpireDate: Date;
  vnp_Locale?: string;
  vnp_BankCode?: string;
};

function getConfig(): VnpayConfig {
  // `trim()` để tránh lỗi dính CRLF (`\r`) hoặc whitespace trong .env
  const tmnCode = process.env.vnp_TmnCode?.trim();
  const hashSecret = process.env.vnp_HashSecret?.trim();
  const baseUrl = process.env.vnp_Url?.trim();
  // Trim trailing slash để tránh double slash trong returnUrl (e.g. "https://xxx.ngrok.app//api/...")
  const nextAuthUrl = process.env.NEXTAUTH_URL?.trim().replace(/\/$/, "");
  const returnUrl = nextAuthUrl
    ? `${nextAuthUrl}/api/payments/vnpay/return`
    : "";

  if (!tmnCode || !hashSecret || !baseUrl || !returnUrl) {
    throw new Error(
      "VNPAY configuration is missing required environment variables. " +
      "Đảm bảo vnp_TmnCode, vnp_HashSecret, vnp_Url và NEXTAUTH_URL đã được cấu hình, " +
      "và vnp_ReturnUrl trùng khớp với URL được đăng ký trên portal VNPAY sandbox.",
    );
  }

  return {
    tmnCode,
    hashSecret,
    baseUrl,
    returnUrl,
  };
}

function sortParams<T extends Record<string, string>>(params: T): T {
  const sorted: Record<string, string> = {};
  const keys = Object.keys(params)
    .map((k) => encodeURIComponent(k))
    .sort();
  for (const encodedKey of keys) {
    const originalKey = decodeURIComponent(encodedKey);
    // Encode value theo ĐÚNG chuẩn VNPAY official NodeJS demo:
    // encodeURIComponent(v) rồi đổi %20 → + (application/x-www-form-urlencoded)
    // Lý do: VNPAY server verify bằng cách này, nếu dùng %20 thay vì + → hash lệch → sai chữ ký
    sorted[encodedKey] = encodeURIComponent(params[originalKey]).replace(/%20/g, "+");
  }
  return sorted as T;
}

function stringifyNoEncode(params: Record<string, string>): string {
  // QUAN TRỌNG: Node's querystring dùng option `encodeURIComponent`, KHÔNG PHẢI `encode`.
  // `{ encode: false }` bị Node ignore → dùng default encoding (tạo ra %20 thay vì +).
  // Sau khi sortParams đã pre-encode values, dùng pass-through để không encode lại lần nữa.
  return querystring.stringify(params, undefined, undefined, {
    encodeURIComponent: (s: string) => s,
  });
}

/**
 * Chuyển Date sang chuỗi yyyyMMddHHmmss theo múi giờ GMT+7 (Vietnam).
 * VNPAY yêu cầu vnp_CreateDate và vnp_ExpireDate ở múi giờ GMT+7.
 */
function toVnpayDateString(date: Date): string {
  const gmt7 = new Date(date.getTime() + 7 * 60 * 60 * 1000);
  return gmt7.toISOString().replace(/[-:TZ.]/g, "").slice(0, 14);
}

export function buildVnpayUrl(params: VnpayPaymentParams): string {
  const config = getConfig();
  const createDate = new Date();
  const vnpCreateDate = toVnpayDateString(createDate);
  const vnpExpireDate = toVnpayDateString(params.vnp_ExpireDate);

  const rawParams: Record<string, string> = {
    vnp_Version: "2.1.0",
    vnp_Command: "pay",
    vnp_TmnCode: config.tmnCode,
    vnp_Amount: String(params.vnp_Amount),
    vnp_CurrCode: "VND",
    vnp_TxnRef: params.vnp_TxnRef,
    vnp_OrderInfo: params.vnp_OrderInfo,
    vnp_OrderType: "other",
    vnp_Locale: params.vnp_Locale ?? "vn",
    vnp_IpAddr: params.vnp_IpAddr,
    vnp_CreateDate: vnpCreateDate,
    vnp_ExpireDate: vnpExpireDate,
    // Giữ nguyên dạng raw, không encode ở đây.
    // VNPAY demo NodeJS cho phép pre-encode giá trị, nhưng chữ ký phải dựa trên đúng chuỗi đã gửi.
    vnp_ReturnUrl: config.returnUrl,
  };

  if (params.vnp_BankCode) {
    rawParams.vnp_BankCode = params.vnp_BankCode;
  }

  const vnpParams = sortParams(rawParams);
  // Bám sát demo NodeJS chính thức: dùng querystring.stringify với encode:false
  const signData = stringifyNoEncode(vnpParams);

  const hmac = crypto.createHmac("sha512", config.hashSecret);
  const secureHash = hmac.update(signData).digest("hex");

  // Debug khi cần đối chiếu chữ ký với VNPAY sandbox (không bật mặc định).
  if (process.env.VNPAY_DEBUG === "true") {
    // Dùng console.log để chắc chắn log hiện trong Next dev
    console.log("[VNPAY][build-url] signData:", signData);
    console.log("[VNPAY][build-url] secureHash:", secureHash);
  }
  // Query gửi sang VNPAY cũng dùng cùng canonicalization (encode:false)
  const queryString = stringifyNoEncode({
    ...vnpParams,
    vnp_SecureHash: secureHash,
  });

  return `${config.baseUrl}?${queryString}`;
}

export function verifyVnpaySignature(query: Record<string, string | string[] | undefined>): boolean {
  const config = getConfig();

  const rawSecureHash = query.vnp_SecureHash;
  const receivedSecureHash = Array.isArray(rawSecureHash)
    ? rawSecureHash[0]
    : rawSecureHash;

  if (!receivedSecureHash) {
    return false;
  }

  const filtered: Record<string, string> = {};
  Object.keys(query).forEach((key) => {
    if (key === "vnp_SecureHash" || key === "vnp_SecureHashType") {
      return;
    }
    const value = query[key];
    if (typeof value === "string") {
      filtered[key] = value;
    } else if (Array.isArray(value) && value[0]) {
      filtered[key] = value[0];
    }
  });

  const sorted = sortParams(filtered);
  const signData = stringifyNoEncode(sorted);

  const hmac = crypto.createHmac("sha512", config.hashSecret);
  const computed = hmac.update(signData).digest("hex");

  return computed.toLowerCase() === receivedSecureHash.toLowerCase();
}

