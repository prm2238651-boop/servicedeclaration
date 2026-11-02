import { LoginPageClient } from "@/components/login-page-client";
import { readSession } from "@/lib/auth";
import { landingPageForSession } from "@/lib/permissions";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const session = await readSession();
  if (session) redirect(landingPageForSession(session));
  return <LoginPageClient/>;
}
