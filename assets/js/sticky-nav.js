/*
 * One-page navigation
 *
 * Shows the slim .sticky-bar once the hero is halfway out of view, and the
 * .section-dots once a section after the hero is the one on screen (hiding
 * them again when the hero comes back), and
 * marks the bar link, the menu link and the dot of the section on screen (.is-current,
 * aria-current). A section is the panel holding an <h2 id>; the hero is the
 * top of the page ("#top").
 * Scrolling to the sections is native (smooth under _sass/sticky-bar.scss).
 * As the page scrolls, the URL follows the section on screen (#about, none
 * for the hero), without adding history entries, so that a reload comes back
 * to it rather than to the last link clicked. Not before the first scroll:
 * the browser may not have jumped to the URL's section yet.
 * Without JS the bar stays hidden, and the dots stay shown.
 * Over a section on the inverted background (.panel-inverse, see
 * _sass/panels.scss), the dots take its colors (.is-inverse).
 */

function mount(bar, hero, dots) {
    // Section headings, in page order (ids set in index.md).
    const sections = Array.from(document.querySelectorAll(".content h2[id]"));
    const inverse = Array.from(document.querySelectorAll(".panel-inverse"));
    const links = Array.from(document.querySelectorAll(
        ".sticky-bar-links a[href*='#'], .section-dots a[href*='#'], .site-menu a[href*='#']",
    )).filter((a) => {
        const url = new URL(a.href);
        return url.pathname === location.pathname;
    });
    let frame = 0;
    let current = null;
    let scrolled = false;   // the page has scrolled since it loaded

    // URL of the section on screen, kept in place (no history entry).
    function syncHash(id) {
        const hash = id === "top" ? "" : "#" + id;
        if (location.hash === hash) {
            return;
        }
        try {
            history.replaceState(history.state, "", location.pathname + location.search + hash);
        } catch (err) {
            // Too many calls in a short time (Safari): the next change catches up.
        }
    }

    function currentId() {
        const doc = document.documentElement;
        if (sections.length && window.scrollY > 0 && window.innerHeight + window.scrollY >= doc.scrollHeight - 2) {
            // At the very bottom, the last section may be too short to reach the top.
            return sections[sections.length - 1].id;
        }
        // The section filling the middle of the window.
        const line = window.innerHeight / 2;
        let id = "top";
        sections.forEach((section) => {
            const panel = section.closest(".panel") || section;
            if (panel.getBoundingClientRect().top <= line) {
                id = section.id;
            }
        });
        return id;
    }

    function update() {
        frame = 0;
        bar.classList.toggle("is-visible", hero.getBoundingClientRect().bottom <= window.innerHeight / 2);
        const id = currentId();
        if (dots) {
            dots.classList.toggle("is-visible", id !== "top");
            const line = window.innerHeight / 2;
            dots.classList.toggle("is-inverse", inverse.some((panel) => {
                const rect = panel.getBoundingClientRect();
                return rect.top <= line && rect.bottom > line;
            }));
        }
        if (scrolled) {
            syncHash(id);
        }
        if (id === current) {
            return;
        }
        current = id;
        links.forEach((a) => {
            const on = new URL(a.href).hash === "#" + id;
            a.classList.toggle("is-current", on);
            if (on) {
                a.setAttribute("aria-current", "location");
            } else {
                a.removeAttribute("aria-current");
            }
        });
    }

    function schedule() {
        if (!frame) {
            frame = requestAnimationFrame(update);
        }
    }

    window.addEventListener("scroll", () => {
        scrolled = true;
        schedule();
    }, { passive: true });
    window.addEventListener("resize", schedule);
    update();
}

const bar = document.querySelector(".sticky-bar");
const hero = document.querySelector(".hero");
if (bar && hero) {
    mount(bar, hero, document.querySelector(".section-dots"));
}
