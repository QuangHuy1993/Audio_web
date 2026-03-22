// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";

const getServerSessionMock = vi.fn();
const findFirstMock = vi.fn();
const updateMock = vi.fn();

vi.mock("next-auth", () => ({
  getServerSession: getServerSessionMock,
}));

vi.mock("@/lib/auth", () => ({
  authOptions: {},
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    checkoutSession: {
      findFirst: findFirstMock,
      update: updateMock,
    },
  },
}));

describe("POST /api/shop/payments/sessions/[id]/cancel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 404 when session is not found", async () => {
    getServerSessionMock.mockResolvedValue({ user: { id: "user_1" } });
    findFirstMock.mockResolvedValue(null);

    const { POST } = await import("./route");
    const request = new Request("http://localhost/api/shop/payments/sessions/s1/cancel", {
      method: "POST",
    }) as NextRequest;

    const response = await POST(request, {
      params: Promise.resolve({ id: "s1" }),
    });

    expect(response.status).toBe(404);
    expect(updateMock).not.toHaveBeenCalled();
  });

  it("returns 400 when session is not pending", async () => {
    getServerSessionMock.mockResolvedValue({ user: { id: "user_1" } });
    findFirstMock.mockResolvedValue({
      id: "s1",
      userId: "user_1",
      status: "SUCCEEDED",
    });

    const { POST } = await import("./route");
    const request = new Request("http://localhost/api/shop/payments/sessions/s1/cancel", {
      method: "POST",
    }) as NextRequest;

    const response = await POST(request, {
      params: Promise.resolve({ id: "s1" }),
    });

    expect(response.status).toBe(400);
    expect(updateMock).not.toHaveBeenCalled();
  });

  it("cancels pending session successfully", async () => {
    getServerSessionMock.mockResolvedValue({ user: { id: "user_1" } });
    findFirstMock.mockResolvedValue({
      id: "s1",
      userId: "user_1",
      status: "PENDING",
    });
    updateMock.mockResolvedValue({
      id: "s1",
      status: "CANCELLED",
    });

    const { POST } = await import("./route");
    const request = new Request("http://localhost/api/shop/payments/sessions/s1/cancel", {
      method: "POST",
    }) as NextRequest;

    const response = await POST(request, {
      params: Promise.resolve({ id: "s1" }),
    });
    const body = (await response.json()) as { success?: boolean };

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(updateMock).toHaveBeenCalledWith({
      where: { id: "s1" },
      data: { status: "CANCELLED" },
    });
  });
});
