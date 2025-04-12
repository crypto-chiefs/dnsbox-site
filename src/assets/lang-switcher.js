const languageSwitcher = document.querySelector('.language-switcher');
const languageBtn = document.querySelector('.language-btn');
const languageMenu = document.querySelector('.language-menu');
const languageOptions = document.querySelectorAll('.language-option');

// Toggle menu on button click
languageBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    const isExpanded = languageSwitcher.classList.contains('active');
    languageSwitcher.classList.toggle('active');
    languageBtn.setAttribute('aria-expanded', !isExpanded);
});

// Close menu when clicking outside
document.addEventListener('click', (e) => {
    if (!languageSwitcher.contains(e.target)) {
        languageSwitcher.classList.remove('active');
        languageBtn.setAttribute('aria-expanded', 'false');
    }
});

// Keyboard navigation
languageSwitcher.addEventListener('keydown', (e) => {
    const isExpanded = languageSwitcher.classList.contains('active');

    switch (e.key) {
        case 'Escape':
            if (isExpanded) {
                languageSwitcher.classList.remove('active');
                languageBtn.setAttribute('aria-expanded', 'false');
                languageBtn.focus();
            }
            break;
        case 'ArrowDown':
            if (!isExpanded) {
                e.preventDefault();
                languageSwitcher.classList.add('active');
                languageBtn.setAttribute('aria-expanded', 'true');
                languageOptions[0].focus();
            }
            break;
        case 'ArrowUp':
            if (isExpanded) {
                e.preventDefault();
                languageSwitcher.classList.remove('active');
                languageBtn.setAttribute('aria-expanded', 'false');
                languageBtn.focus();
            }
            break;
    }
});

// Handle keyboard navigation within menu
languageMenu.addEventListener('keydown', (e) => {
    const currentOption = document.activeElement;
    const options = Array.from(languageOptions);
    const currentIndex = options.indexOf(currentOption);

    switch (e.key) {
        case 'ArrowDown':
            e.preventDefault();
            if (currentIndex < options.length - 1) {
                options[currentIndex + 1].focus();
            }
            break;
        case 'ArrowUp':
            e.preventDefault();
            if (currentIndex > 0) {
                options[currentIndex - 1].focus();
            } else {
                languageBtn.focus();
            }
            break;
        case 'Tab':
            e.preventDefault();
            if (e.shiftKey && currentIndex === 0) {
                languageBtn.focus();
            } else if (!e.shiftKey && currentIndex === options.length - 1) {
                languageBtn.focus();
            } else {
                options[e.shiftKey ? currentIndex - 1 : currentIndex + 1].focus();
            }
            break;
    }
});