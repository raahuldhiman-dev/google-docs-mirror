import Dashboard from "@/components/Dashboard";
import Login from "@/components/Login";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function Home() {
  const user = await getCurrentUser();
  return user ? <Dashboard user={user} /> : <Login />;
}
