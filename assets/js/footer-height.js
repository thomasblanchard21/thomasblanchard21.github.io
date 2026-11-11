/*
 * Footer height
 *
 * Sets --footer-height on <html> to the footer's height, which the CSS uses
 * to fit the footer into the last screen (see _sass/panels.scss). Without JS
 * the CSS falls back to $footer-height.
 */

const footer = document.querySelector(".site-footer");
if (footer && "ResizeObserver" in window) {
    const set = () => {
        document.documentElement.style.setProperty("--footer-height", footer.offsetHeight + "px");
    };
    new ResizeObserver(set).observe(footer);
    set();
}
