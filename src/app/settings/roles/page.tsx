"use client";

import { permissionCapabilities } from "@/lib/data";
import { SectionHeader } from "@/components/ui";
import { usePrototype } from "@/lib/store";

export default function RolesPage() {
  const { roles, togglePermission } = usePrototype();

  return (
    <div>
      <SectionHeader
        title="Roles & Permissions"
        description="The permission model per role. Click a cell to toggle access — in the real platform this drives what each role can see and do."
      />

      <div className="mt-6 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-black">
              <th className="label py-3 pr-6 text-left font-medium">Role</th>
              {permissionCapabilities.map((cap) => (
                <th
                  key={cap}
                  className="label px-2 py-3 text-center font-medium"
                  style={{ maxWidth: 90 }}
                >
                  {cap}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {roles.map((role) => (
              <tr key={role.id}>
                <td className="whitespace-nowrap py-3 pr-6 font-medium text-ink">
                  {role.name}
                </td>
                {permissionCapabilities.map((cap) => {
                  const granted = role.permissions[cap];
                  return (
                    <td key={cap} className="px-2 py-3 text-center">
                      <button
                        onClick={() => togglePermission(role.id, cap)}
                        className={`h-5 w-5 border text-[11px] leading-none transition-colors ${
                          granted
                            ? "border-black bg-black text-paper"
                            : "border-line text-transparent hover:border-black"
                        }`}
                        aria-label={`${role.name}: ${cap} ${granted ? "granted" : "not granted"}`}
                      >
                        ✓
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-4 text-xs text-muted">
        Client Viewer and Stakeholder Reviewer only see client-facing pages —
        internal metrics like member workload stay internal (spec §35).
      </p>
    </div>
  );
}
