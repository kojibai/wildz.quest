import { readFile } from "node:fs/promises";
import path from "node:path";
import { WorldLawReader } from "./WorldLawReader";
import { WILDS_CONSTITUTION } from "@/features/play/wilds-constitution";
import { WILDS_COMMAND_LAW } from "@/features/play/wilds-world-constitution";
export const metadata = { title: "World Law", description: "Truth of Breath: the source constitution and the rules governing Wildz transitions." };
export default async function WorldLawPage() {
  const source = await readFile(path.join(process.cwd(), WILDS_CONSTITUTION.source), "utf8");
  return <WorldLawReader source={source} version={WILDS_CONSTITUTION.version} digest={WILDS_CONSTITUTION.sourceDigest} laws={[...new Set(Object.values(WILDS_COMMAND_LAW))]} />;
}
