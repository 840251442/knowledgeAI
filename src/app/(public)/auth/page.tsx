import { redirect } from "next/navigation";

export default function PersonalAuthPage() {
  redirect("/admin/login");
}