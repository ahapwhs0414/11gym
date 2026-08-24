import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";

export default async function RootPage() {
  const session = await getSession();

  if (session.role === "ADMIN") {
    redirect("/admin/dashboard");
  }
  if (session.role === "USER") {
    redirect("/home");
  }
  redirect("/login");
}
