import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { parseDocument } from "htmlparser2";
import langs from "../src/_data/langs.js";

// Pass a base URL to run the same checks against a preview or a deployment.
const base = process.argv[2];
const origin = "https://dnsbox.io";
const pagePath = lang => lang === "en" ? "/" : `/${lang}.html`;
const expectedAlternates = Object.fromEntries([
    ...langs.map(lang => [lang, origin + pagePath(lang)]),
    ["x-default", origin + "/"]
]);
const load = async path => {
    if (base) {
        const response = await fetch(new URL(path, base), { redirect: "manual" });
        assert.equal(response.status, 200, `${path}: expected HTTP 200`);
        return response.text();
    }
    return readFile(resolve("dist", path === "/" ? "index.html" : `.${path}`), "utf8");
};
const elements = (node, predicate) => (node.children || []).flatMap(child => [
    ...(predicate(child) ? [child] : []), ...elements(child, predicate)
]);
const named = (root, name) => elements(root, node => node.name === name);
const text = node => node.type === "text" ? node.data : (node.children || []).map(text).join("");
const one = (items, label) => {
    assert.equal(items.length, 1, `${label}: expected one element, got ${items.length}`);
    return items[0];
};
const alternates = nodes => {
    assert.equal(nodes.length, langs.length + 1, "Wrong number of hreflang alternatives");
    const values = Object.fromEntries(nodes.map(node => [node.attribs.hreflang, node.attribs.href]));
    assert.deepEqual(values, expectedAlternates);
};
const documents = new Map();
const titles = new Set();
const descriptions = new Set();
const assets = new Set();
const localLinks = [];
for (const lang of langs) {
    const path = pagePath(lang);
    const html = await load(path);
    assert(!html.includes("{{") && !html.includes("[object Object]"), `${path}: unrendered template`);
    const doc = parseDocument(html);
    documents.set(path, doc);
    assert.equal(one(named(doc, "html"), path).attribs.lang, lang);
    const head = one(named(doc, "head"), `${path} head`);
    const title = text(one(named(head, "title"), `${path} title`)).trim();
    assert(title.length > 5, `${path}: missing title`);
    titles.add(title);
    const meta = (attribute, value) => one(elements(head, node => node.name === "meta" && node.attribs[attribute] === value), `${path} ${value}`).attribs.content;
    const description = meta("name", "description");
    assert(description.length > 30, `${path}: missing description`);
    descriptions.add(description);
    assert(!meta("name", "robots").includes("noindex"), `${path}: blocked indexing`);
    const canonical = one(elements(head, node => node.name === "link" && node.attribs.rel === "canonical"), `${path} canonical`).attribs.href;
    assert.equal(canonical, origin + path);
    assert.equal(meta("property", "og:url"), canonical);
    assert(meta("property", "og:title") && meta("property", "og:description"));
    assert(meta("property", "og:locale"));
    assert.equal(meta("name", "twitter:image"), meta("property", "og:image"));
    assets.add(new URL(meta("property", "og:image")).pathname);
    alternates(elements(head, node => node.name === "link" && node.attribs.rel === "alternate"));
    assert(text(one(named(doc, "h1"), `${path} h1`)).trim(), `${path}: empty h1`);
    for (const heading of [...named(doc, "h2"), ...named(doc, "h3")]) {
        assert(text(heading).trim(), `${path}: empty heading`);
    }
    const ids = elements(doc, node => Boolean(node.attribs?.id)).map(node => node.attribs.id);
    assert.equal(new Set(ids).size, ids.length, `${path}: duplicate IDs`);
    const schema = JSON.parse(text(one(elements(doc, node => node.name === "script" && node.attribs.type === "application/ld+json"), `${path} schema`)));
    assert.equal(schema["@context"], "https://schema.org");
    assert.equal(schema.url, canonical);
    assert(schema.name && schema.description && schema.softwareVersion);
    assert(!schema.aggregateRating && !schema.review, `${path}: unverified reviews`);
    for (const element of elements(doc, node => Boolean(node.attribs?.href || node.attribs?.src))) {
        const href = element.attribs.href || element.attribs.src;
        const url = new URL(href, canonical);
        if (url.origin === origin) localLinks.push({ from: path, url });
    }
}
assert.equal(titles.size, langs.length, "Page titles must be localized");
assert.equal(descriptions.size, langs.length, "Descriptions must be localized");
for (const { from, url } of localLinks) {
    if (documents.has(url.pathname)) {
        if (url.hash) {
            assert(elements(documents.get(url.pathname), node => node.attribs?.id === decodeURIComponent(url.hash.slice(1))).length, `${from}: broken link ${url}`);
        }
    } else {
        assert(url.pathname.startsWith("/assets/"), `${from}: unexpected internal link ${url}`);
        assets.add(url.pathname);
    }
}
const manifest = JSON.parse(await load("/assets/site.webmanifest"));
assert(manifest.name && manifest.short_name && manifest.start_url === "/");
for (const icon of manifest.icons) assets.add(icon.src);
for (const path of assets) {
    if (base) {
        const response = await fetch(new URL(path, base), { method: "HEAD", redirect: "manual" });
        assert.equal(response.status, 200, `${path}: missing asset`);
    } else {
        assert((await readFile(resolve("dist", `.${path}`))).length, `${path}: empty asset`);
    }
}
const sitemap = parseDocument(await load("/sitemap.xml"), { xmlMode: true });
const entries = named(sitemap, "url");
assert.equal(entries.length, langs.length, "Wrong number of sitemap pages");
assert.deepEqual(entries.map(entry => text(one(named(entry, "loc"), "sitemap loc"))).sort(), Object.values(expectedAlternates).filter((url, i, all) => all.indexOf(url) === i).sort());
for (const entry of entries) {
    alternates(named(entry, "xhtml:link"));
    const modified = text(one(named(entry, "lastmod"), "sitemap lastmod"));
    assert(/^\d{4}-\d{2}-\d{2}$/.test(modified) && Number.isFinite(Date.parse(modified)), "Invalid sitemap date");
}
assert((await load("/robots.txt")).includes(`Sitemap: ${origin}/sitemap.xml`), "Missing sitemap in robots.txt");
if (base) {
    for (const path of ["/index.html?from=check", "/en.html?from=check"]) {
        const response = await fetch(new URL(path, base), { redirect: "manual" });
        assert.equal(response.status, 301, `${path}: missing canonical redirect`);
        const location = new URL(response.headers.get("location"), base);
        assert.equal(location.pathname, "/");
        assert.equal(location.search, "?from=check");
    }
    for (const path of ["/missing-page-seo-check", "/assets/"]) {
        const response = await fetch(new URL(path, base), { redirect: "manual" });
        assert.equal(response.status, 404, `${path}: expected a real 404`);
    }
    const response = await fetch(new URL("/", base));
    const etag = response.headers.get("etag");
    assert(etag, "Missing content validator");
    assert.equal(response.headers.get("last-modified"), null, "Unexpected build timestamp");
    const revalidated = await fetch(new URL("/", base), { headers: { "If-None-Match": etag } });
    assert.equal(revalidated.status, 304, "Content revalidation failed");
}
console.log(`Checked ${langs.length} localized pages, metadata, hreflang, structured data, sitemap and ${assets.size} assets${base ? ` at ${base}` : ""}.`);
