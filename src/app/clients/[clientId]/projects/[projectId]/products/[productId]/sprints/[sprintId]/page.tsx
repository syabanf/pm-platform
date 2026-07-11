import { redirect } from "next/navigation";

export default async function SprintIndexPage({
  params,
}: {
  params: Promise<{
    clientId: string;
    projectId: string;
    productId: string;
    sprintId: string;
  }>;
}) {
  const { clientId, projectId, productId, sprintId } = await params;
  redirect(
    `/clients/${clientId}/projects/${projectId}/products/${productId}/sprints/${sprintId}/board`
  );
}
