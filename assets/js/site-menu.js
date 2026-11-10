/*
 * Small-screen menu
 *
 * Shows the menu button (_includes/site-menu.html) and opens or closes the
 * menu under it (.is-open, aria-expanded). It closes on a link click, on
 * Escape (focus goes back to the button), on a click or tap outside, when the
 * page scrolls, and when the window grows past $nav-collapse-width (the
 * button is then hidden by the CSS, see _sass/site-menu.scss). The theme row
 * is wired by theme.js and leaves the menu open.
 */

function mount(button, menu) {
    function isOpen() {
        return button.getAttribute("aria-expanded") === "true";
    }

    function setOpen(open) {
        button.setAttribute("aria-expanded", open ? "true" : "false");
        button.setAttribute("aria-label", open ? "Close menu" : "Open menu");
        menu.classList.toggle("is-open", open);
    }

    button.addEventListener("click", () => setOpen(!isOpen()));

    menu.addEventListener("click", (event) => {
        if (event.target.closest("a")) {
            setOpen(false);
        }
    });

    document.addEventListener("keydown", (event) => {
        if (event.key === "Escape" && isOpen()) {
            setOpen(false);
            button.focus();
        }
    });

    document.addEventListener("pointerdown", (event) => {
        if (isOpen() && !menu.contains(event.target) && !button.contains(event.target)) {
            setOpen(false);
        }
    });

    // Scrolling moves on to a section: the menu has done its job. Clicking a
    // link scrolls too, which closes it a second time (harmless).
    window.addEventListener("scroll", () => {
        if (isOpen()) {
            setOpen(false);
        }
    }, { passive: true });

    window.addEventListener("resize", () => {
        if (isOpen() && getComputedStyle(button).display === "none") {
            setOpen(false);
        }
    });

    button.hidden = false;
}

const button = document.querySelector(".menu-toggle");
const menu = document.getElementById("site-menu");
if (button && menu) {
    mount(button, menu);
}
