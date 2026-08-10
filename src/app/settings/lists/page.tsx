import { redirect } from "next/navigation";

/**
 * The list masters moved to /settings/masters, where each list has its own
 * page. This keeps old links — bookmarks, and anything that shipped pointing
 * here — landing somewhere useful instead of a 404.
 */
export default function ListMastersRedirect() {
  redirect("/settings/masters");
}
