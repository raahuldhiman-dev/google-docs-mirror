import { redirect } from "next/navigation";
import Editor from "@/components/Editor";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function DocPage({ params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) redirect("/");
  return <Editor docId={params.id} user={user} />;
}
