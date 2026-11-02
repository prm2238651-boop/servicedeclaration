import { AppShell } from "@/components/app-shell";
import { DeclarationForm } from "@/components/declaration-form";
import { readSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { hasPermission, landingPageForSession } from "@/lib/permissions";
export default async function NewReportPage(){const session=await readSession();if(!session)redirect("/login");if(!hasPermission(session,"DECLARE"))redirect(landingPageForSession(session));return <AppShell active="/declarations/nouvelle"><DeclarationForm/></AppShell>}
