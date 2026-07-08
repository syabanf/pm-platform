import { notFound, redirect } from "next/navigation";
import { getSprint, sprintPath } from "@/lib/data";

export default async function SprintIndexPage({
  params,
}: {
  params: Promise<{ sprintId: string }>;
}) {
  const { sprintId } = await params;
  const sprint = getSprint(sprintId);
  if (!sprint) notFound();
  redirect(`${sprintPath(sprint)}/board`);
}
