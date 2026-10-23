import { readFile } from "fs/promises";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import langs from "./langs.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

export default async function () {
    const result = {};
    for (const lang of langs) {
        const file = resolve(__dirname, `../locales/${lang}.json`);
        result[lang] = JSON.parse(await readFile(file, "utf-8"));
    }
    const keys = value => Object.entries(value).flatMap(([key, item]) => {
        if (typeof item === "string" && item.trim()) return [key];
        if (item && typeof item === "object" && !Array.isArray(item)) {
            return keys(item).map(child => `${key}.${child}`);
        }
        throw new Error(`Empty or invalid translation at ${key}`);
    }).sort();
    const expected = JSON.stringify(keys(result.en));
    for (const lang of langs) {
        if (JSON.stringify(keys(result[lang])) !== expected) {
            throw new Error(`Translation keys in ${lang}.json do not match en.json`);
        }
    }
    return result;
}
