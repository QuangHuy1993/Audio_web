import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ShopHeader from "./ShopHeader";

const useSessionMock = vi.fn();

vi.mock("next-auth/react", () => ({
  useSession: () => useSessionMock(),
  signOut: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/",
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
  }),
}));

vi.mock("next/image", () => ({
  default: (props: React.ImgHTMLAttributes<HTMLImageElement>) => <img {...props} />,
}));

vi.mock("@/features/shop/context/CartContext", () => ({
  useCartContext: () => ({ cartItemCount: 0, refreshCartCount: vi.fn() }),
}));

describe("ShopHeader payment bell", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("does not render bell button when unauthenticated", () => {
    useSessionMock.mockReturnValue({ data: null });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify(null), { status: 200 })),
    );

    render(<ShopHeader />);
    expect(screen.queryByLabelText("Thông báo thanh toán")).toBeNull();
  });

  it("renders bell button for authenticated user", async () => {
    useSessionMock.mockReturnValue({
      data: { user: { id: "u1", role: "USER", name: "Test User" } },
    });

    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/shop/payments/sessions/active")) {
        return new Response(
          JSON.stringify({
            id: "cs_1",
            provider: "VIETQR",
            status: "PENDING",
            expiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
            amount: 1000000,
            currency: "VND",
            paymentUrl: null,
          }),
          { status: 200 },
        );
      }
      return new Response(JSON.stringify({ itemCount: 0 }), { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<ShopHeader />);

    expect(screen.getByLabelText("Thông báo thanh toán")).toBeTruthy();
    await waitFor(() => {
      const bellButton = screen.getByLabelText("Thông báo thanh toán");
      const badge = bellButton.querySelector("span");
      expect(badge).toBeTruthy();
    });
  });
});
