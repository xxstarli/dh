import { getNavigation } from "@/lib/navigation";
import { authenticated } from "@/lib/auth";
import { Navigation } from "@/components/navigation";
export const dynamic = "force-dynamic";
export default async function Home() {
  const [data, admin] = await Promise.all([getNavigation(), authenticated()]);
  return <Navigation initialData={data} initialAdmin={admin} />;
}
