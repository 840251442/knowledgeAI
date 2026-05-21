import { redirect } from "next/navigation";

import { getSessionCookieName } from "@/lib/auth/session";

export default async function AdminLogoutPage() {
  const cookieStore = await (await import("next/headers")).cookies();
  cookieStore.set(getSessionCookieName(), "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });

  redirect("/admin/login");
}

