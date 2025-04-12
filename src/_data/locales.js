import { readFile } from "fs/promises";
import { existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import langs from "./langs.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

export default async function () {
    const result = {};
    for (const lang of langs) {
        const file = resolve(__dirname, `../locales/${lang}.json`);
        result[lang] = existsSync(file)
            ? JSON.parse(await readFile(file, "utf-8"))
            : {};
    }
    return result;
}