export default {
    permalink: function (data) {
        const lang = data.lang;

        // en -> index.html, ru -> ru.html
        return lang === "en" ? "index.html" : `${lang}.html`;
    },
    eleventyComputed: {
        translations: data => data.locales?.[data.lang] || {},
        pageUrl: data => `https://dnsbox.io/${data.lang === "en" ? "" : data.lang + ".html"}`,
        softwareSchema: data => ({
            "@context": "https://schema.org",
            "@type": "SoftwareApplication",
            name: "DNSBox",
            softwareVersion: "0.5.2",
            applicationCategory: "DeveloperApplication",
            operatingSystem: "Linux, macOS, Windows",
            url: `https://dnsbox.io/${data.lang === "en" ? "" : data.lang + ".html"}`,
            description: data.locales?.[data.lang]?.layout.schema_description,
            license: "https://github.com/crypto-chiefs/dnsbox/blob/v0.5.2/LICENSE",
            isAccessibleForFree: true,
            downloadUrl: "https://github.com/crypto-chiefs/dnsbox/releases/tag/v0.5.2",
            sameAs: "https://github.com/crypto-chiefs/dnsbox",
            author: { "@type": "Organization", name: "crypto-chiefs", url: "https://github.com/crypto-chiefs" }
        }),
        currentLanguage: data => {
            const lang = data.lang;
            switch (lang){
                case "en": return "🇬🇧 English"
                case "ru": return "🇷🇺 Русский"
                case "es": return "🇪🇸 Español"
                case "de": return "🇩🇪 Deutsch"
                case "fr": return "🇫🇷 Français"
                case "zh": return "🇨🇳 中文"
                case "hi": return "🇮🇳 हिंदी"
                case "pt": return "🇧🇷 Português"
                case "tr": return "🇹🇷 Türkçe"
                case "id": return "🇮🇩 Indonesia"
                case "vi": return "🇻🇳 Tiếng Việt"
                case "ko": return "🇰🇷 한국어"
            }
        },
        currentLanguageActive: (data) => {
            const lang = data.lang;
            return (linkLang) => {
                return lang === linkLang ? "active" : "";
            };
        }
    },
    layout: "layout.njk"
};
