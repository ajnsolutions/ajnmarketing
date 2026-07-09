import { register } from "node:module";
import { pathToFileURL } from "node:url";

register(pathToFileURL(new URL("./server-only-stub-hook.mjs", import.meta.url).pathname));
