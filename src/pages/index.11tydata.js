export default {
    permalink: function (data) {
        const lang = data.lang;

        // en -> index.html, ru -> ru.html
        return lang === "en" ? "index.html" : `${lang}.html`;
    },
    eleventyComputed: {
        translations: data => data.locales?.[data.lang] || {},
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
