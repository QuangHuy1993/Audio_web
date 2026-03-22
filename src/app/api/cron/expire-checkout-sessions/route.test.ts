// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";

const updateManyMock = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    checkoutSession: {
      updateMany: updateManyMock,
    },
  },
}));

describe("POST /api/cron/expire-checkout-sessions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 403 when CRON_SECRET is set but header is invalid", async () => {
    process.env.CRON_SECRET = "test-secret";
    const { POST } = await import("./route");

    const request = new Request("http://localhost/api/cron/expire-checkout-sessions", {
      method: "POST",
      headers: {
        authorization: "Bearer wrong-secret",
      },
    }) as NextRequest;

    const response = await POST(request);
    expect(response.status).toBe(403);
    expect(updateManyMock).not.toHaveBeenCalled();
  });

  it("expires pending sessions when auth header is valid", async () => {
    process.env.CRON_SECRET = "test-secret";
    updateManyMock.mockResolvedValue({ count: 2 });
    const { POST } = await import("./route");

    const request = new Request("http://localhost/api/cron/expire-checkout-sessions", {
      method: "POST",
      headers: {
        authorization: "Bearer test-secret",
      },
    }) as NextRequest;

    const response = await POST(request);
    const body = (await response.json()) as { expired: number };

    expect(response.status).toBe(200);
    expect(body.expired).toBe(2);
    expect(updateManyMock).toHaveBeenCalledTimes(1);
  });
});
