import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import PaymentNotificationPopup from "./PaymentNotificationPopup";

describe("PaymentNotificationPopup", () => {
  it("renders empty state when no pending session", () => {
    render(
      <PaymentNotificationPopup
        isOpen
        isLoading={false}
        session={null}
        onClose={vi.fn()}
        onContinue={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    expect(
      screen.getByText("Không có đơn hàng nào đang chờ thanh toán."),
    ).toBeTruthy();
    expect(screen.getByRole("button", { name: "Đóng" })).toBeTruthy();
  });

  it("renders pending session info and action buttons", () => {
    const onContinue = vi.fn();
    const onCancel = vi.fn();

    render(
      <PaymentNotificationPopup
        isOpen
        isLoading={false}
        session={{
          id: "cs_1",
          provider: "VIETQR",
          expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
          amount: 1250000,
          currency: "VND",
          paymentUrl: null,
        }}
        onClose={vi.fn()}
        onContinue={onContinue}
        onCancel={onCancel}
      />,
    );

    expect(screen.getByText("VietQR")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Tiếp tục thanh toán" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Huỷ đơn này" })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Tiếp tục thanh toán" }));
    fireEvent.click(screen.getByRole("button", { name: "Huỷ đơn này" }));
    expect(onContinue).toHaveBeenCalledTimes(1);
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("shows expired state and only close action", () => {
    render(
      <PaymentNotificationPopup
        isOpen
        isLoading={false}
        session={{
          id: "cs_2",
          provider: "VNPAY",
          expiresAt: new Date(Date.now() - 60 * 1000).toISOString(),
          amount: 500000,
          currency: "VND",
          paymentUrl: "https://vnpay.test",
        }}
        onClose={vi.fn()}
        onContinue={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    expect(screen.getByText("Phiên đã hết hạn")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Tiếp tục thanh toán" })).toBeNull();
    expect(screen.getByRole("button", { name: "Đóng" })).toBeTruthy();
  });
});
