import type { NextAuthOptions } from "next-auth";
import type { Adapter } from "next-auth/adapters";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import { PrismaAdapter } from "@auth/prisma-adapter";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma) as Adapter,
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      allowDangerousEmailAccountLinking: true,
    }),
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Mật khẩu", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email?.trim() || !credentials?.password) {
          return null;
        }

        try {
          const user = await prisma.user.findUnique({
            where: { email: credentials.email.trim().toLowerCase() },
            select: {
              id: true,
              email: true,
              name: true,
              image: true,
              role: true,
              passwordHash: true,
              emailVerified: true,
            },
          });

          if (!user?.passwordHash) {
            return null;
          }

          const valid = await bcrypt.compare(
            credentials.password,
            user.passwordHash,
          );
          if (!valid) {
            return null;
          }

          return {
            id: user.id,
            email: user.email ?? undefined,
            name: user.name ?? undefined,
            image: user.image ?? undefined,
            role: user.role,
            // Truyền emailVerified sang token/session để client có thể kiểm tra đã kích hoạt.
            emailVerified: user.emailVerified ?? null,
          };
        } catch (error) {
          // Gracefully handle database connectivity or query errors
          console.error(
            "[Auth][Credentials] Failed to authorize user via Prisma",
            error,
          );
          return null;
        }
      },
    }),
  ],
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 ngày
  },
  callbacks: {
    async signIn({ user, account }) {
      if (account?.type === "oauth" && user?.id) {
        try {
          const dbUser = await prisma.user.findUnique({
            where: { id: user.id },
            select: { role: true, emailVerified: true, image: true },
          });
          if (dbUser) {
            (user as any).role = dbUser.role;
            (user as any).emailVerified = dbUser.emailVerified;
            // Ưu tiên ảnh trong DB (Cloudinary) hơn ảnh từ Google
            if (dbUser.image) {
              user.image = dbUser.image;
            }
          }
        } catch (error) {
          console.error("[Auth][Google] signIn callback error", error);
        }
      }
      return true;
    },
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.email = user.email ?? undefined;
        token.name = user.name ?? undefined;
        token.picture = user.image ?? undefined;
        // user có thể đến từ Credentials (trên) hoặc từ adapter Prisma (Google, v.v.)
        token.emailVerified =
          user.emailVerified ?? token.emailVerified ?? null;
      }

      // Khi client gọi update(), chúng ta cập nhật token
      if (trigger === "update" && session?.user) {
        if (session.user.name) token.name = session.user.name;
        if (session.user.image) token.picture = session.user.image;
        if (session.user.email) token.email = session.user.email;
        if (session.user.role) token.role = session.user.role;
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = (token.id as string) ?? "";
        session.user.role = (token.role as string) ?? "USER";
        session.user.name = token.name;
        session.user.email = token.email;
        session.user.image = token.picture;
        // Truyền emailVerified vào session để client kiểm tra trạng thái kích hoạt.
        // Kiểu có thể là string hoặc Date tùy cách NextAuth serialize.

        session.user.emailVerified = token.emailVerified ?? null;
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
  secret: process.env.NEXTAUTH_SECRET,
};
