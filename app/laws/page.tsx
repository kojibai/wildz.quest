import { readFile } from "node:fs/promises";
import path from "node:path";
import Link from "next/link";
import { WILDS_CONSTITUTION } from "@/features/play/wilds-constitution";
import { WILDS_COMMAND_LAW } from "@/features/play/wilds-world-constitution";
export const metadata = { title: "World Law · Wildz", description: "Truth of Breath: the source constitution and the rules governing Wildz transitions." };
export default async function WorldLawPage() {
  const source = await readFile(path.join(process.cwd(), WILDS_CONSTITUTION.source), "utf8");
  return <main style={{ maxWidth: 880, margin: "0 auto", padding: "48px 24px", color: "#e5f3ed", lineHeight: 1.7 }}>
    <Link href="/">← Return to Wildz</Link>
    <p>TRUTH OF BREATH · VERSION {WILDS_CONSTITUTION.version}</p><h1>World law</h1>
    <p>Every defined world command must pass its source rules. Its receipt identifies the actor, source state, authority, predicates and successor. A founder, administrator, majority or machine receives no override through status alone.</p>
    <p>Construction owns produced improvements; it grants no absolute title to Earth. Claims remain allegations until evidence and a defined finding establish more. Competing published branches remain disputed. Rules without adopted decision predicates grant no executable authority.</p>
    <h2>Connected transition laws</h2><ul>{[...new Set(Object.values(WILDS_COMMAND_LAW))].map(law => <li key={law}>{law.replaceAll(".", " · ").replaceAll("-", " ")}</li>)}</ul>
    <p>Community allocation, abandonment thresholds, guardianship appointments, adjudication, remedies, insolvency and ratification still require explicit adopted procedures. The current game does not execute those transitions. The constitutional predicate library can evaluate supplied source facts; it does not establish them or issue human standing.</p>
    <h2>Source constitution</h2><p style={{ overflowWrap: "anywhere", fontSize: 12 }}>{WILDS_CONSTITUTION.sourceDigest}</p>
    <article style={{ whiteSpace: "pre-wrap", fontFamily: "inherit" }}>{source}</article>
  </main>;
}
