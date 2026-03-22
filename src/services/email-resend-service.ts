import { Resend } from "resend";

type SendAccountActivationEmailParams = {
  toEmail: string;
  fullName: string;
  otpCode: string;
  expiresMinutes: number;
};

type SendPasswordResetEmailParams = {
  toEmail: string;
  fullName: string;
  otpCode: string;
  expiresMinutes: number;
};

type SendOrderConfirmationEmailParams = {
  toEmail: string;
  fullName: string;
  orderNumber: string;
  totalAmount: number;
  shippingFee: number;
  couponDiscount: number;
  items: {
    name: string;
    quantity: number;
    unitPrice: number;
    subtotal: number;
  }[];
  shippingAddress: {
    fullName: string;
    phone: string;
    line1: string;
    line2?: string | null;
    ward?: string | null;
    district?: string | null;
    province?: string | null;
  } | null;
  orderDetailUrl: string;
};

type SendOrderStatusUpdateEmailParams = {
  toEmail: string;
  fullName: string;
  orderNumber: string;
  newStatus: string;
};

const resendApiKey = process.env.RESEND_API_KEY;
const resendFromEmail = process.env.RESEND_FROM_EMAIL;
const resendFromName = process.env.RESEND_FROM_NAME ?? "Duc Uy Audio";

if (!resendApiKey) {
  console.warn(
    "[email-resend-service] Missing RESEND_API_KEY. Emails will not be sent.",
  );
}

if (!resendFromEmail) {
  console.warn(
    "[email-resend-service] Missing RESEND_FROM_EMAIL. Emails will not be sent.",
  );
}

const resendClient = resendApiKey ? new Resend(resendApiKey) : null;

function isEmailServiceConfigured(): boolean {
  if (!resendClient || !resendFromEmail) {
    return false;
  }

  return true;
}

function buildActivationEmailHtml(params: {
  fullName: string;
  otpCode: string;
  expiresMinutes: number;
}): string {
  const { fullName, otpCode, expiresMinutes } = params;
  const safeName = fullName || "bạn";

  return `
    <div style="font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #111827; max-width: 480px; margin: 0 auto;">
      <h2 style="font-size: 20px; font-weight: 600; margin-bottom: 12px;">Chào ${safeName},</h2>
      <p style="margin: 8px 0;">
        Cảm ơn bạn đã đăng ký tài khoản tại <strong>Đức Uy Audio</strong>.
      </p>
      <p style="margin: 8px 0;">
        Mã OTP kích hoạt tài khoản của bạn là:
      </p>
      <p style="font-size: 24px; font-weight: 700; letter-spacing: 4px; margin: 16px 0;">
        ${otpCode}
      </p>
      <p style="margin: 8px 0;">
        Mã này có hiệu lực trong <strong>${expiresMinutes} phút</strong>. Vui lòng không chia sẻ mã này cho bất kỳ ai.
      </p>
      <p style="margin: 8px 0;">
        Nếu bạn không thực hiện yêu cầu này, bạn có thể bỏ qua email này một cách an toàn.
      </p>
      <p style="margin-top: 24px;">
        Trân trọng,<br />
        <strong>Đức Uy Audio</strong>
      </p>
    </div>
  `;
}

function buildPasswordResetEmailHtml(params: {
  fullName: string;
  otpCode: string;
  expiresMinutes: number;
}): string {
  const { fullName, otpCode, expiresMinutes } = params;
  const safeName = fullName || "bạn";

  return `
    <div style="font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #111827; max-width: 480px; margin: 0 auto;">
      <h2 style="font-size: 20px; font-weight: 600; margin-bottom: 12px;">Chào ${safeName},</h2>
      <p style="margin: 8px 0;">
        Chúng tôi nhận được yêu cầu đặt lại mật khẩu cho tài khoản của bạn tại <strong>Đức Uy Audio</strong>.
      </p>
      <p style="margin: 8px 0;">
        Mã OTP để đặt lại mật khẩu là:
      </p>
      <p style="font-size: 24px; font-weight: 700; letter-spacing: 4px; margin: 16px 0;">
        ${otpCode}
      </p>
      <p style="margin: 8px 0;">
        Mã này có hiệu lực trong <strong>${expiresMinutes} phút</strong>. Vui lòng không chia sẻ mã này cho bất kỳ ai.
      </p>
      <p style="margin: 8px 0;">
        Nếu bạn không thực hiện yêu cầu đặt lại mật khẩu, bạn có thể bỏ qua email này. Mật khẩu của bạn sẽ không bị thay đổi.
      </p>
      <p style="margin-top: 24px;">
        Trân trọng,<br />
        <strong>Đức Uy Audio</strong>
      </p>
    </div>
  `;
}

function buildOrderConfirmationEmailHtml(params: SendOrderConfirmationEmailParams): string {
  const {
    fullName,
    orderNumber,
    totalAmount,
    shippingFee,
    couponDiscount,
    items,
    shippingAddress,
    orderDetailUrl,
  } = params;

  const safeName = fullName || "bạn";

  const formatVnd = (value: number): string =>
    new Intl.NumberFormat("vi-VN", {
      style: "currency",
      currency: "VND",
      maximumFractionDigits: 0,
    }).format(value);

  const itemsHtml = items
    .map(
      (item) => `
        <tr>
          <td style="padding: 8px 0; font-size: 14px;">
            ${item.name} <span style="color:#6b7280;">x${item.quantity}</span>
          </td>
          <td style="padding: 8px 0; font-size: 14px; text-align:right;">
            ${formatVnd(item.subtotal)}
          </td>
        </tr>
      `,
    )
    .join("");

  const addressHtml = shippingAddress
    ? `
      <p style="margin: 4px 0;">${shippingAddress.fullName}</p>
      <p style="margin: 4px 0;">${shippingAddress.phone}</p>
      <p style="margin: 4px 0;">${shippingAddress.line1}</p>
      ${
        shippingAddress.line2
          ? `<p style="margin: 4px 0;">${shippingAddress.line2}</p>`
          : ""
      }
      <p style="margin: 4px 0;">
        ${[
          shippingAddress.ward,
          shippingAddress.district,
          shippingAddress.province,
        ]
          .filter(Boolean)
          .join(", ")}
      </p>
    `
    : "<p style=\"margin: 4px 0;\">Chưa có địa chỉ giao hàng.</p>";

  const totalBeforeDiscount = totalAmount + couponDiscount;

  return `
    <div style="font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #111827; max-width: 640px; margin: 0 auto;">
      <h2 style="font-size: 20px; font-weight: 600; margin-bottom: 12px;">Cảm ơn ${safeName} đã đặt hàng tại Đức Uy Audio.</h2>
      <p style="margin: 8px 0;">
        Đơn hàng của bạn đã được tạo thành công với mã <strong>#${orderNumber}</strong>.
      </p>

      <h3 style="font-size: 16px; font-weight: 600; margin: 20px 0 8px;">Sản phẩm đã đặt</h3>
      <table style="width: 100%; border-collapse: collapse;">
        <thead>
          <tr>
            <th style="text-align:left; padding-bottom: 8px; font-size: 13px; color:#6b7280;">Sản phẩm</th>
            <th style="text-align:right; padding-bottom: 8px; font-size: 13px; color:#6b7280;">Thành tiền</th>
          </tr>
        </thead>
        <tbody>
          ${itemsHtml}
        </tbody>
      </table>

      <h3 style="font-size: 16px; font-weight: 600; margin: 20px 0 8px;">Địa chỉ giao hàng</h3>
      <div style="font-size: 14px; line-height: 1.5;">
        ${addressHtml}
      </div>

      <h3 style="font-size: 16px; font-weight: 600; margin: 20px 0 8px;">Tổng kết đơn hàng</h3>
      <table style="width: 100%; font-size: 14px;">
        <tbody>
          <tr>
            <td style="padding: 4px 0; color:#6b7280;">Tạm tính</td>
            <td style="padding: 4px 0; text-align:right;">${formatVnd(totalBeforeDiscount)}</td>
          </tr>
          <tr>
            <td style="padding: 4px 0; color:#6b7280;">Giảm giá</td>
            <td style="padding: 4px 0; text-align:right;">-${formatVnd(couponDiscount)}</td>
          </tr>
          <tr>
            <td style="padding: 4px 0; color:#6b7280;">Phí vận chuyển</td>
            <td style="padding: 4px 0; text-align:right;">${formatVnd(shippingFee)}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; font-weight: 700;">Tổng thanh toán</td>
            <td style="padding: 8px 0; text-align:right; font-weight: 700;">${formatVnd(
              totalAmount,
            )}</td>
          </tr>
        </tbody>
      </table>

      <div style="margin-top: 24px;">
        <a
          href="${orderDetailUrl}"
          style="
            display: inline-block;
            padding: 10px 18px;
            border-radius: 999px;
            background: #111827;
            color: #f9fafb;
            font-size: 14px;
            font-weight: 500;
            text-decoration: none;
          "
        >
          Xem chi tiết đơn hàng
        </a>
      </div>

      <p style="margin-top: 24px; font-size: 13px; color:#6b7280;">
        Nếu bạn không thực hiện đơn hàng này, vui lòng liên hệ ngay với Đức Uy Audio để được hỗ trợ.
      </p>

      <p style="margin-top: 16px;">
        Trân trọng,<br />
        <strong>Đức Uy Audio</strong>
      </p>
    </div>
  `;
}

function getSafeResendClient() {
  if (!isEmailServiceConfigured()) {
    return null;
  }

  return resendClient;
}

export async function sendAccountActivationEmail(
  params: SendAccountActivationEmailParams,
): Promise<void> {
  const client = getSafeResendClient();

  if (!client) {
    return;
  }

  const html = buildActivationEmailHtml({
    fullName: params.fullName,
    otpCode: params.otpCode,
    expiresMinutes: params.expiresMinutes,
  });

  try {
    const { error } = await client.emails.send({
      from: `${resendFromName} <${resendFromEmail}>`,
      to: [params.toEmail],
      subject: "Kích hoạt tài khoản Đức Uy Audio",
      html,
    });

    if (error) {
      const anyError = error as unknown as {
        name?: string;
        message?: string;
        statusCode?: number;
        cause?: unknown;
      };

      console.error(
        "[email-resend-service] Failed to send account activation email.",
        {
          name: anyError?.name ?? null,
          message: anyError?.message ?? null,
          statusCode: anyError?.statusCode ?? null,
          cause: anyError?.cause ?? null,
        },
      );
    }
  } catch (error) {
    const unknownError = error as {
      name?: string;
      message?: string;
      statusCode?: number;
      cause?: unknown;
      response?: {
        body?: unknown;
      };
    };

    const responseBody = unknownError?.response?.body;

    console.error(
      "[email-resend-service] Unexpected error while sending account activation email.",
      {
        name: unknownError?.name ?? null,
        message: unknownError?.message ?? null,
        statusCode: unknownError?.statusCode ?? null,
        cause: unknownError?.cause ?? null,
        responseBody:
          responseBody && typeof responseBody === "object"
            ? JSON.stringify(responseBody)
            : responseBody ?? null,
      },
    );
  }
}

export async function sendPasswordResetEmail(
  params: SendPasswordResetEmailParams,
): Promise<void> {
  const client = getSafeResendClient();

  if (!client) {
    return;
  }

  const html = buildPasswordResetEmailHtml({
    fullName: params.fullName,
    otpCode: params.otpCode,
    expiresMinutes: params.expiresMinutes,
  });

  try {
    const { error } = await client.emails.send({
      from: `${resendFromName} <${resendFromEmail}>`,
      to: [params.toEmail],
      subject: "Đặt lại mật khẩu tài khoản Đức Uy Audio",
      html,
    });

    if (error) {
      const anyError = error as unknown as {
        name?: string;
        message?: string;
        statusCode?: number;
        cause?: unknown;
      };

      console.error(
        "[email-resend-service] Failed to send password reset email.",
        {
          name: anyError?.name ?? null,
          message: anyError?.message ?? null,
          statusCode: anyError?.statusCode ?? null,
          cause: anyError?.cause ?? null,
        },
      );
    }
  } catch (error) {
    const unknownError = error as {
      name?: string;
      message?: string;
      statusCode?: number;
      cause?: unknown;
      response?: {
        body?: unknown;
      };
    };

    const responseBody = unknownError?.response?.body;

    console.error(
      "[email-resend-service] Unexpected error while sending password reset email.",
      {
        name: unknownError?.name ?? null,
        message: unknownError?.message ?? null,
        statusCode: unknownError?.statusCode ?? null,
        cause: unknownError?.cause ?? null,
        responseBody:
          responseBody && typeof responseBody === "object"
            ? JSON.stringify(responseBody)
            : responseBody ?? null,
      },
    );
  }
}

export async function sendOrderConfirmationEmail(
  params: SendOrderConfirmationEmailParams,
): Promise<void> {
  const client = getSafeResendClient();

  if (!client) {
    return;
  }

  const html = buildOrderConfirmationEmailHtml(params);

  try {
    const { error } = await client.emails.send({
      from: `${resendFromName} <${resendFromEmail}>`,
      to: [params.toEmail],
      subject: `Xác nhận đơn hàng #${params.orderNumber} - Đức Uy Audio`,
      html,
    });

    if (error) {
      const anyError = error as unknown as {
        name?: string;
        message?: string;
        statusCode?: number;
        cause?: unknown;
      };

      console.error(
        "[email-resend-service] Failed to send order confirmation email.",
        {
          name: anyError?.name ?? null,
          message: anyError?.message ?? null,
          statusCode: anyError?.statusCode ?? null,
          cause: anyError?.cause ?? null,
        },
      );
    }
  } catch (error) {
    const unknownError = error as {
      name?: string;
      message?: string;
      statusCode?: number;
      cause?: unknown;
      response?: {
        body?: unknown;
      };
    };

    const responseBody = unknownError?.response?.body;

    console.error(
      "[email-resend-service] Unexpected error while sending order confirmation email.",
      {
        name: unknownError?.name ?? null,
        message: unknownError?.message ?? null,
        statusCode: unknownError?.statusCode ?? null,
        cause: unknownError?.cause ?? null,
        responseBody:
          responseBody && typeof responseBody === "object"
            ? JSON.stringify(responseBody)
            : responseBody ?? null,
      },
    );
  }
}

export async function sendOrderStatusUpdateEmail(
  params: SendOrderStatusUpdateEmailParams,
): Promise<void> {
  const client = getSafeResendClient();

  if (!client) {
    return;
  }

  const safeName = params.fullName || "bạn";

  const html = `
    <div style="font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #111827; max-width: 640px; margin: 0 auto;">
      <h2 style="font-size: 20px; font-weight: 600; margin-bottom: 12px;">Cập nhật trạng thái đơn hàng #${params.orderNumber}</h2>
      <p style="margin: 8px 0;">
        Chào ${safeName},
      </p>
      <p style="margin: 8px 0;">
        Đơn hàng của bạn tại <strong>Đức Uy Audio</strong> đã được cập nhật sang trạng thái:
      </p>
      <p style="margin: 12px 0; font-size: 16px; font-weight: 700;">
        ${params.newStatus}
      </p>
      <p style="margin: 8px 0;">
        Nếu bạn không thực hiện đơn hàng này hoặc có bất kỳ thắc mắc nào, vui lòng liên hệ với chúng tôi để được hỗ trợ.
      </p>
      <p style="margin-top: 24px;">
        Trân trọng,<br />
        <strong>Đức Uy Audio</strong>
      </p>
    </div>
  `;

  try {
    const { error } = await client.emails.send({
      from: `${resendFromName} <${resendFromEmail}>`,
      to: [params.toEmail],
      subject: `Cập nhật trạng thái đơn hàng #${params.orderNumber} - Đức Uy Audio`,
      html,
    });

    if (error) {
      const anyError = error as unknown as {
        name?: string;
        message?: string;
        statusCode?: number;
        cause?: unknown;
      };

      console.error(
        "[email-resend-service] Failed to send order status update email.",
        {
          name: anyError?.name ?? null,
          message: anyError?.message ?? null,
          statusCode: anyError?.statusCode ?? null,
          cause: anyError?.cause ?? null,
        },
      );
    }
  } catch (error) {
    const unknownError = error as {
      name?: string;
      message?: string;
      statusCode?: number;
      cause?: unknown;
      response?: {
        body?: unknown;
      };
    };

    const responseBody = unknownError?.response?.body;

    console.error(
      "[email-resend-service] Unexpected error while sending order status update email.",
      {
        name: unknownError?.name ?? null,
        message: unknownError?.message ?? null,
        statusCode: unknownError?.statusCode ?? null,
        cause: unknownError?.cause ?? null,
        responseBody:
          responseBody && typeof responseBody === "object"
            ? JSON.stringify(responseBody)
            : responseBody ?? null,
      },
    );
  }
}



