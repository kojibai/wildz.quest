import { rmSync } from "node:fs";
import { resolve } from "node:path";

rmSync(resolve(process.cwd(), ".test-build"), { recursive: true, force: true });
