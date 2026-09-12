import { publicPageMetadata } from "@/lib/wildz/search-metadata";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { RULE_DETAILS } from "./rule-details";
import { WorldLawReader } from "./WorldLawReader";
import { WILDS_CONSTITUTION } from "@/features/play/wilds-constitution";
import { WILDS_COMMAND_LAW } from "@/features/play/wilds-world-constitution";
export const metadata = publicPageMetadata("World Law", "Truth of Breath: the source constitution and the rules governing Wildz transitions.", "/laws");
export default async function WorldLawPage() {
  const source = await readFile(path.join(process.cwd(), WILDS_CONSTITUTION.source), "utf8");
  return <WorldLawReader source={source} version={WILDS_CONSTITUTION.version} digest={WILDS_CONSTITUTION.sourceDigest} rules={[...new Set(Object.values(WILDS_COMMAND_LAW))].map(id => ({ id, ...RULE_DETAILS[id], commands: Object.entries(WILDS_COMMAND_LAW).filter(([, law]) => law === id).map(([command]) => command) }))} />;
}
