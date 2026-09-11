import { getNavigation } from "@/lib/navigation";
import { ok, failure } from "@/lib/http";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    return ok(await getNavigation());
  } catch (e) {
    return failure(e);
  }
}
