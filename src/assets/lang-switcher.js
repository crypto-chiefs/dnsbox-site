const languageSwitcher = document.querySelector('.language-switcher');
const languageBtn = document.querySelector('.language-btn');
const languageMenu = document.querySelector('.language-menu');
const languageOptions = Array.from(document.querySelectorAll('.language-option'));

// Menu items receive focus through arrow keys; Tab moves out of the menu.
languageOptions.forEach(option => { option.tabIndex = -1; });

function setLanguageMenuOpen(open, focusTarget) {
    languageSwitcher.classList.toggle('active', open);
    languageBtn.setAttribute('aria-expanded', String(open));
    focusTarget?.focus();
}

languageBtn.addEventListener('click', () => {
    const open = !languageSwitcher.classList.contains('active');
    setLanguageMenuOpen(open, open ? languageOptions[0] : languageBtn);
});

languageBtn.addEventListener('keydown', event => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        const target = event.key === 'ArrowDown'
            ? languageOptions[0]
            : languageOptions[languageOptions.length - 1];
        setLanguageMenuOpen(true, target);
    } else if (event.key === 'Escape') {
        setLanguageMenuOpen(false, languageBtn);
    }
});

languageMenu.addEventListener('keydown', event => {
    const currentIndex = languageOptions.indexOf(document.activeElement);
    let nextIndex;

    switch (event.key) {
        case 'ArrowDown':
            nextIndex = (currentIndex + 1) % languageOptions.length;
            break;
        case 'ArrowUp':
            nextIndex = (currentIndex - 1 + languageOptions.length) % languageOptions.length;
            break;
        case 'Home':
            nextIndex = 0;
            break;
        case 'End':
            nextIndex = languageOptions.length - 1;
            break;
        case 'Escape':
            event.preventDefault();
            setLanguageMenuOpen(false, languageBtn);
            return;
        case 'Tab':
            // Let the browser move focus before hiding the focused menu item.
            window.setTimeout(() => setLanguageMenuOpen(false), 0);
            return;
        default:
            return;
    }

    event.preventDefault();
    languageOptions[nextIndex]?.focus();
});

document.addEventListener('click', event => {
    if (!languageSwitcher.contains(event.target)) {
        setLanguageMenuOpen(false);
    }
});

languageSwitcher.addEventListener('focusout', event => {
    if (!languageSwitcher.contains(event.relatedTarget)) {
        setLanguageMenuOpen(false);
    }
});
