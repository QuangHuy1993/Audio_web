import NextAuth from "next-auth";
import { authOptions } from "@/lib/auth";

// Đảm bảo NextAuth chạy trên Node.js runtime (không phải Edge)
export const runtime = "nodejs";
// Tránh cache động cho endpoint auth
export const dynamic = "force-dynamic";

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
