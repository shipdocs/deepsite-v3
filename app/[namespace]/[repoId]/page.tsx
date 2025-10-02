import { AppEditor } from "@/components/editor";

export default async function ProjectNamespacePage({
  params,
}: {
  params: Promise<{ namespace: string; repoId: string }>;
}) {
  const { namespace, repoId } = await params;
  return <AppEditor namespace={namespace} repoId={repoId} />;
}
