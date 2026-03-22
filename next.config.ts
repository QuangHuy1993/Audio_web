import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Cloudinary đã tự optimize (f_auto / q_auto) qua transformation URL.
    // Next.js chỉ cần biết domain để cho phép load, không re-encode thêm.
    remotePatterns: [
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
      },
      {
        protocol: "https",
        hostname: "res.cloudinary.com",
      },
      {
        protocol: "https",
        hostname: "img.vietqr.io",
      },
    ],
    // Cho phép Next.js serve thêm AVIF nếu ảnh đến từ nguồn không phải Cloudinary.
    formats: ["image/avif", "image/webp"],
  },
};

export default nextConfig;
