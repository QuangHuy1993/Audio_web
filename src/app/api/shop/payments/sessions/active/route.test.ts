// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from "vitest";

const getServerSessionMock = vi.fn();
const updateManyMock = vi.fn();
const findFirstMock = vi.fn();

vi.mock("next-auth", () => ({
  getServerSession: getServerSessionMock,
}));

vi.mock("@/lib/auth", () => ({
  authOptions: {},
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    checkoutSession: {
      updateMany: updateManyMock,
      findFirst: findFirstMock,
    },
  },
}));

describe("GET /api/shop/payments/sessions/active", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when unauthenticated", async () => {
    getServerSessionMock.mockResolvedValue(null);
    const { GET } = await import("./route");

    const response = await GET();
    expect(response.status).toBe(401);
    expect(updateManyMock).not.toHaveBeenCalled();
    expect(findFirstMock).not.toHaveBeenCalled();
  });

  it("lazy-expires past sessions then returns latest active pending session", async () => {
    const now = new Date("2026-03-14T10:00:00.000Z");
    vi.useFakeTimers();
    vi.setSystemTime(now);

    getServerSessionMock.mockResolvedValue({
      user: { id: "user_1", role: "USER" },
    });

    updateManyMock.mockResolvedValue({ count: 1 });
    findFirstMock.mockResolvedValue({
      id: "cs_1",
      provider: "VIETQR",
      status: "PENDING",
      expiresAt: new Date("2026-03-14T10:20:00.000Z"),
      amount: "1500000",
      currency: "VND",
      paymentUrl: null,
    });

    const { GET } = await import("./route");
    const response = await GET();
    const body = (await response.json()) as {
      id: string;
      provider: string;
      status: string;
      amount: number;
      paymentUrl: string | null;
    };

    expect(response.status).toBe(200);
    expect(updateManyMock).toHaveBeenCalledTimes(1);
    expect(findFirstMock).toHaveBeenCalledTimes(1);
    expect(body.id).toBe("cs_1");
    expect(body.provider).toBe("VIETQR");
    expect(body.status).toBe("PENDING");
    expect(body.amount).toBe(1500000);
    expect(body.paymentUrl).toBeNull();

    vi.useRealTimers();
  });
});
