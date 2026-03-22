import type { Metadata } from "next";
import "./reset.css";
import "./globals.css";
import AppToaster from "@/components/ui/AppToaster";
import AuthProvider from "@/components/providers/AuthProvider";
import { CartProvider } from "@/features/shop/context/CartContext";
import { AiChatProvider } from "@/features/shop/context/AiChatContext";
import FloatingAiButton from "@/components/shared/FloatingAiButton";

export const metadata: Metadata = {
  title: "Đức Uy Audio",
  description:
    "Đức Uy Audio – Hệ thống thương mại điện tử thiết bị âm thanh hi-fi và hi-end với trải nghiệm tư vấn AI, so sánh và gợi ý phối ghép phòng nghe.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link
          rel="preconnect"
          href="https://fonts.googleapis.com"
        />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
      </head>
      <body>
        <AuthProvider>
          <CartProvider>
            <AiChatProvider>
              <AppToaster />
              {children}
              <FloatingAiButton />
            </AiChatProvider>
          </CartProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
