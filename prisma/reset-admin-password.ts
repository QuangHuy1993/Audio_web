import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

/**
 * Script đặt lại mật khẩu ADMIN cho Audio AI Shop.
 *
 * Cách dùng:
 * 1. Sửa lại hằng số `ADMIN_EMAIL` / `NEW_PASSWORD` bên dưới nếu cần.
 * 2. Chạy lệnh:
 *    npx tsx prisma/reset-admin-password.ts
 *
 * Sau khi chạy thành công, bạn đăng nhập bằng email ADMIN_EMAIL
 * và mật khẩu NEW_PASSWORD.
 */

const prisma = new PrismaClient();

// Email admin hiện đang có trong DB
const ADMIN_EMAIL = "admin@gmail.com";

// Mật khẩu ADMIN mới mà bạn muốn đặt
const NEW_PASSWORD = "Admin@123"; // có thể sửa lại theo ý bạn

async function main() {
  if (!ADMIN_EMAIL) {
    throw new Error("ADMIN_EMAIL is empty. Please set a valid email.");
  }

  if (!NEW_PASSWORD) {
    throw new Error("NEW_PASSWORD is empty. Please set a valid password.");
  }

  const existingUser = await prisma.user.findUnique({
    where: { email: ADMIN_EMAIL },
  });

  if (!existingUser) {
    throw new Error(`Không tìm thấy user với email: ${ADMIN_EMAIL}`);
  }

  const passwordHash = await bcrypt.hash(NEW_PASSWORD, 10);

  await prisma.user.update({
    where: { email: ADMIN_EMAIL },
    data: { passwordHash },
  });

  // eslint-disable-next-line no-console
  console.log(
    `Đã cập nhật mật khẩu ADMIN cho "${ADMIN_EMAIL}". Mật khẩu mới là: ${NEW_PASSWORD}`,
  );
}

main()
  .catch((error) => {
    // eslint-disable-next-line no-console
    console.error("Lỗi khi reset mật khẩu ADMIN:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

