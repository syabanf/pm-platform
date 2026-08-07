import { redirect } from "next/navigation";

export default async function SprintIndexPage({
  params,
}: {
  params: Promise<{
    clientId: string;
    projectId: string;
    moduleId: string;
    sprintId: string;
  }>;
}) {
  const { clientId, projectId, moduleId, sprintId } = await params;
  redirect(
    `/clients/${clientId}/projects/${projectId}/modules/${moduleId}/sprints/${sprintId}/board`
  );
}
