/**
 * Chuẩn hóa URL redirect sau đăng nhập theo role và callbackUrl.
 * ADMIN: chỉ chấp nhận path /admin; USER: không chấp nhận /admin.
 */
export type AuthRole = "USER" | "ADMIN";

export function getRedirectAfterLogin(
  role: AuthRole,
  callbackUrl: string | null | undefined,
  baseUrl: string
): string {
  const defaultAdmin = "/admin/dashboard";
  const defaultUser = "/";

  if (!callbackUrl || callbackUrl.trim() === "") {
    return role === "ADMIN" ? defaultAdmin : defaultUser;
  }

  const trimmed = callbackUrl.trim();
  let path: string;
  try {
    const parsed = new URL(trimmed, baseUrl);
    if (parsed.origin !== baseUrl) {
      return role === "ADMIN" ? defaultAdmin : defaultUser;
    }
    path = parsed.pathname;
  } catch {
    if (trimmed.startsWith("/")) {
      path = trimmed.split("?")[0] ?? trimmed;
    } else {
      return role === "ADMIN" ? defaultAdmin : defaultUser;
    }
  }

  if (path === "/login" || path === "/register") {
    return role === "ADMIN" ? defaultAdmin : defaultUser;
  }

  if (role === "ADMIN") {
    return path.startsWith("/admin") ? path : defaultAdmin;
  }

  return path.startsWith("/admin") ? defaultUser : path;
}
