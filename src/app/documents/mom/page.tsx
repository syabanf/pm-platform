"use client";

import { useState } from "react";
import {
  AIFootnote,
  DocActions,
  DocEmptyState,
  DocHeader,
  DocPageShell,
  DocSection,
  DocumentArticle,
  Field,
  GenerateButton,
  inputClass,
} from "@/components/Document";
import { ToggleButton } from "@/components/ui";
import { clients } from "@/lib/data";
import { parseMomBullets, type ParsedMom } from "@/lib/parsers";
import { usePrototype } from "@/lib/store";

const SAMPLE_BULLETS = `- Reviewed OEE dashboard progress with Pak Hendra
- Client agreed the OEE formula is valid for Line 1
- Aditiya will validate telemetry API once sample data arrives by Friday
- Pak Hendra to provide sample machine data by 11 July
- Discussed downtime category list, ownership still unclear
- Who owns the downtime category master data?
- Decided pilot scope stays limited to Line 1
- Risya will update the requirement doc after client confirmation`;

export default function MomGeneratorPage() {
  const { showToast } = usePrototype();
  const [clientId, setClientId] = useState(clients[0].id);
  const [title, setTitle] = useState("Sprint 03 Progress Review with UBS Gold");
  const [date, setDate] = useState("2026-07-08");
  const [attendeesRaw, setAttendeesRaw] = useState(
    "Fahmi, Risya, Aditiya, Pak Hendra"
  );
  const [bullets, setBullets] = useState(SAMPLE_BULLETS);
  const [parsed, setParsed] = useState<ParsedMom | null>(null);

  const attendees = attendeesRaw
    .split(",")
    .map((a) => a.trim())
    .filter(Boolean);
  const client = clients.find((c) => c.id === clientId);

  const generate = () => {
    if (!bullets.trim()) {
      showToast("Paste at least one bullet point first.", "warning");
      return;
    }
    setParsed(parseMomBullets(bullets, attendees));
    showToast("MoM drafted. Review and edit before sharing.", "success");
  };

  return (
    <DocPageShell
      label="Documents / MoM"
      title="Minutes of Meeting"
      description="Paste raw bullet points from a meeting. They are sorted into discussion notes, decisions, action items with owners, and open questions — ready to share with the client."
      form={
        <>
          <Field label="Client">
            <div className="flex flex-wrap gap-1.5">
              {clients.map((c) => (
                <ToggleButton
                  key={c.id}
                  active={clientId === c.id}
                  size="md"
                  onClick={() => setClientId(c.id)}
                >
                  {c.name}
                </ToggleButton>
              ))}
            </div>
          </Field>
          <Field label="Meeting Title">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className={inputClass}
            />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Date">
              <input
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className={inputClass}
              />
            </Field>
            <Field label="Attendees">
              <input
                value={attendeesRaw}
                onChange={(e) => setAttendeesRaw(e.target.value)}
                placeholder="Comma-separated"
                className={inputClass}
              />
            </Field>
          </div>
          <Field label="Bullet Points">
            <textarea
              value={bullets}
              onChange={(e) => setBullets(e.target.value)}
              rows={12}
              className={`${inputClass} font-mono text-xs leading-relaxed`}
              placeholder={"- What was discussed\n- What was decided\n- Who will do what by when"}
            />
            <p className="mt-1.5 text-xs text-muted">
              Tip: lines with &ldquo;decided/agreed&rdquo; become decisions,
              &ldquo;X will … by …&rdquo; become action items, lines ending in
              &ldquo;?&rdquo; become open questions.
            </p>
          </Field>
          <GenerateButton onClick={generate} label="Generate MoM" />
        </>
      }
      document={
        parsed ? (
          <DocumentArticle>
            <DocHeader
              docType="Minutes of Meeting"
              date={date}
              title={title}
              meta={[
                { label: "Client", value: client?.name ?? "—" },
                { label: "Prepared by", value: "Fahmi" },
              ]}
            />

            <DocSection number={1} title="Attendees">
              <p>{attendees.join(", ") || "—"}</p>
            </DocSection>

            <DocSection number={2} title="Discussion Notes">
              <ul className="space-y-1">
                {parsed.notes.length === 0 && <li className="text-muted">—</li>}
                {parsed.notes.map((note) => (
                  <li key={note}>— {note}</li>
                ))}
              </ul>
            </DocSection>

            <DocSection number={3} title="Decisions">
              <ul className="space-y-1">
                {parsed.decisions.length === 0 && (
                  <li className="text-muted">No decisions captured.</li>
                )}
                {parsed.decisions.map((decision) => (
                  <li key={decision} className="flex gap-2">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 bg-success" />
                    {decision}
                  </li>
                ))}
              </ul>
            </DocSection>

            <DocSection number={4} title="Action Items">
              {parsed.actions.length === 0 ? (
                <p className="text-muted">No action items captured.</p>
              ) : (
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-black text-left">
                      <th className="label py-2 pr-4 font-medium">Action</th>
                      <th className="label py-2 pr-4 font-medium">Owner</th>
                      <th className="label py-2 font-medium">Due</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {parsed.actions.map((action) => (
                      <tr key={action.text}>
                        <td className="py-2 pr-4">{action.text}</td>
                        <td
                          className={`py-2 pr-4 whitespace-nowrap ${action.owner === "Unassigned" ? "text-warning" : ""}`}
                        >
                          {action.owner}
                        </td>
                        <td className="py-2 whitespace-nowrap tabular-nums">
                          {action.due}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </DocSection>

            <DocSection number={5} title="Open Questions">
              <ul className="space-y-1">
                {parsed.questions.length === 0 && (
                  <li className="text-muted">No open questions.</li>
                )}
                {parsed.questions.map((question) => (
                  <li key={question} className="flex gap-2">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 bg-warning" />
                    {question}
                  </li>
                ))}
              </ul>
            </DocSection>

            <AIFootnote
              text={`${parsed.decisions.length} decisions, ${parsed.actions.length} action items, and ${parsed.questions.length} open questions were extracted from ${
                parsed.notes.length +
                parsed.decisions.length +
                parsed.actions.length +
                parsed.questions.length
              } bullets.`}
            />

            <DocActions
              extra={[
                {
                  label: "Send Decisions to Decision Log",
                  toast: "Decisions sent to the module Decision Log (prototype).",
                },
              ]}
            />
          </DocumentArticle>
        ) : (
          <DocEmptyState hint="Fill in the meeting info, paste your bullets, and generate a client-ready MoM." />
        )
      }
    />
  );
}
