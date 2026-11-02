import { redirect } from "next/navigation";
import { readSession } from "@/lib/auth";
import { landingPageForSession } from "@/lib/permissions";
export default async function Home() { const session=await readSession();redirect(landingPageForSession(session)); }
