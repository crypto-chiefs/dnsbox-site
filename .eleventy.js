export default function(eleventyConfig) {
    eleventyConfig.addTransform("normalizeMarkup", function (content) {
        if (this.page.outputPath?.match(/\.(html|xml)$/)) {
            return content.replace(/\r\n/g, "\n").replace(/^[\t ]+$/gm, "");
        }
        return content;
    });
    eleventyConfig.addFilter("jsonLd", value => JSON.stringify(value).replace(/</g, "\\u003c"));
    eleventyConfig.addGlobalData("links", {
        release: "https://github.com/crypto-chiefs/dnsbox/releases/tag/v0.5.2",
        deployment: "https://github.com/crypto-chiefs/dnsbox/blob/v0.5.2/doc/deployment.md",
        migration: "https://github.com/crypto-chiefs/dnsbox/blob/v0.5.2/doc/migration-v0.5.md",
        configuration: "https://github.com/crypto-chiefs/dnsbox/blob/v0.5.2/doc/configuration.md"
    });
    eleventyConfig.addPassthroughCopy("src/assets");
    eleventyConfig.addPassthroughCopy("src/robots.txt");
    return {
        dir: {
            input: "src",
            data: "_data",
            includes: "_includes",
            output: "dist"
        }
    };
}
