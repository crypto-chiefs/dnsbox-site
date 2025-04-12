export default function(eleventyConfig) {
    eleventyConfig.addPassthroughCopy("src/assets");
    eleventyConfig.addPassthroughCopy("src/robots.txt");
    eleventyConfig.addPassthroughCopy("src/sitemap.xml");
    return {
        dir: {
            input: "src",
            data: "_data",
            includes: "_includes",
            output: "dist"
        }
    };
}