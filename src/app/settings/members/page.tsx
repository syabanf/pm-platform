"use client";

import { MembersMaster } from "@/components/MembersMaster";

export default function WorkspaceMembersPage() {
  return (
    <MembersMaster
      heading="Workspace Member Master"
      description="Everyone who can be staffed on a module. Module teams and sprint members are drawn from this pool."
    />
  );
}
