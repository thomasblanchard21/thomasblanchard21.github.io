/*
 * Section scrolling
 *
 * Moves through the hero and the section panels of index.md (one per screen,
 * see _sass/hero.scss and _sass/panels.scss) with the mouse wheel, trackpad and keyboard. Inside a
 * section taller than the window, scrolling moves through it as usual. The
 * edge of a section pushes back: scrolling into it builds up a pressure that
 * leaks away over time, and the page moves on to the next section, landing
 * on its top, once the pressure reaches BREAK. A gentle scroll stops at the
 * edge; a typical flick of the mouse wheel goes on to the top of the next
 * section (the rest of the gesture only pushes on the next edge), and a hard
 * one goes through several sections.
 * The keys don't push against the edge: from the edge of a section, one
 * press moves on to the next one. Inside a section taller than the window,
 * the arrow keys scroll by ARROW and Page Up/Down and Space by a page,
 * stopping at its edge. The keys work whatever has focus, except in text
 * fields, and Space on a focused button (which presses it).
 *
 * Touch is handled here too, not by the browser: native touch scrolling runs
 * off the main thread, ahead of the relief canvas (domain-warp-header.js),
 * which then trails the text. A vertical drag moves the page with the finger,
 * and past a section edge at DRAG of its speed, showing the next section.
 * On release, a drag past the edge by PULL of the window, or a flick towards
 * it faster than FLICK, moves on to the next section; otherwise the page
 * settles back (inside a tall section, a flick coasts on for COAST ms).
 * This also stops the browser's pull-to-refresh. Sideways drags, pinches and
 * a zoomed-in page are left to the browser.
 * Clicks on links to a section are animated here as well: the browser's own
 * smooth scrolling to an anchor fights the CSS snapping on phones.
 *
 * The scrolling is animated here (the browser's own is cancelled), easing
 * towards a target, with the CSS scroll snapping off meanwhile. Under
 * reduced motion the page jumps instead. Without JS, the native scrolling
 * and snapping take over.
 * When an animation starts, a "section-scroll:start" event on document lets
 * the relief schedule its frames after this one's, to draw the new position.
 *
 * Also sets --footer-height on <html>, which the CSS uses to fit the footer
 * into the last screen.
 */

const BREAK = 240;      // px of pressure that takes the page past a section edge (a wheel notch is ~100)
const LEAK = 500;       // ms for the pressure to leak down to about a third
const QUIET = 150;      // ms without input that ends a gesture
const GLIDE = 90;       // ms, time constant of the scrolling animation
const LINE = 40;        // px per line, for wheel events counted in lines
const ARROW = 100;      // px per arrow key press inside a tall section
const PAGE = 0.85;      // Page Up/Down and Space, as a fraction of the window height
const DRAG = 0.4;       // past a section edge, the page follows the finger at this rate
const PULL = 0.2;       // finger travel past the edge, as a fraction of the window height, that moves on
const FLICK = 0.4;      // px/ms, a release at least this fast past the edge moves on
const COAST = 300;      // ms of coasting after a flick inside a tall section
const SAMPLE = 100;     // ms of the drag measured for the release speed
const SLOP = 6;         // px of finger travel before a touch counts as a drag

function measureFooter(footer) {
    const set = () => {
        document.documentElement.style.setProperty("--footer-height", footer.offsetHeight + "px");
    };
    new ResizeObserver(set).observe(footer);
    set();
}

// Scroll positions [lo, hi] at which each panel's snap area fills the window
// (lo === hi unless the panel is taller than the window).
function screens(panels) {
    const view = window.innerHeight;
    const max = document.documentElement.scrollHeight - view;
    return panels.map((panel) => {
        const rect = panel.getBoundingClientRect();
        const style = getComputedStyle(panel);
        const top = rect.top + window.scrollY - parseFloat(style.scrollMarginTop);
        const bottom = rect.bottom + window.scrollY + parseFloat(style.scrollMarginBottom);
        const clamp = (y) => Math.min(max, Math.max(0, Math.round(y)));
        if (bottom - top <= view) {
            const y = clamp((top + bottom - view) / 2);
            return [y, y];
        }
        return [clamp(top), clamp(bottom - view)];
    });
}

// The screen whose range is closest to scroll position y.
function closest(list, y) {
    let index = 0;
    let best = Infinity;
    list.forEach(([lo, hi], k) => {
        const d = y < lo ? lo - y : y > hi ? y - hi : 0;
        if (d < best) {
            best = d;
            index = k;
        }
    });
    return index;
}

function mount(panels) {
    const root = document.documentElement;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    let target = null;      // where the animation is heading, null when idle
    let pos = 0;            // animated scroll position
    let applied = 0;        // scroll position after the previous frame
    let frame = 0;
    let time = 0;           // time of the previous animation frame
    let pressure = 0;       // px pushed against the current section edge
    let pressureDir = 0;
    let pressureTime = 0;
    let crossed = false;    // the current gesture moved on to another section

    function stop() {
        cancelAnimationFrame(frame);
        frame = 0;
        target = null;
        root.style.scrollSnapType = "";
    }

    function step(now) {
        if (Math.abs(window.scrollY - applied) > 2) {
            stop(); // something else scrolled the page (a link, touch)
            return;
        }
        // (A frame's timestamp may be older than the start of the animation.)
        pos += (target - pos) * (1 - Math.exp(-Math.max(0, now - time) / GLIDE));
        time = Math.max(time, now);
        if (Math.abs(target - pos) < 0.5) {
            window.scrollTo({ top: target, behavior: "instant" });
            stop();
            return;
        }
        window.scrollTo({ top: pos, behavior: "instant" });
        applied = window.scrollY;
        frame = requestAnimationFrame(step);
    }

    function scrollTo(y) {
        if (reduced.matches) {
            root.style.scrollSnapType = ""; // (a drag turned it off)
            window.scrollTo({ top: y, behavior: "instant" });
            return;
        }
        root.style.scrollSnapType = "none";
        if (!frame) {
            pos = window.scrollY;
            applied = pos;
            time = performance.now();
            frame = requestAnimationFrame(step);
            document.dispatchEvent(new Event("section-scroll:start"));
        }
        target = y;
    }

    // Scroll by delta px. stopAtEdge (keys): a scroll that moved inside a
    // tall section stops at its edge, and one from the edge goes through.
    function push(delta, stopAtEdge) {
        const dir = Math.sign(delta);
        const now = performance.now();
        if (dir !== pressureDir || now - pressureTime > QUIET) {
            crossed = false;
        }
        pressure = dir === pressureDir ? pressure * Math.exp(-(now - pressureTime) / LEAK) : 0;
        pressureDir = dir;
        pressureTime = now;

        const list = screens(panels);
        let y = target === null ? window.scrollY : target;
        let i = closest(list, y);
        const [lo, hi] = list[i];
        // (Less than 2px of room is the edge: the page may settle a pixel short.
        // After moving on, the rest of the gesture stays on the section's top.)
        const room = crossed ? 0 : Math.max(0, dir > 0 ? hi - y : y - lo);
        let rest = Math.abs(delta);
        if (room >= 2) {
            const moved = Math.min(rest, room);
            y += dir * moved;
            rest = stopAtEdge ? 0 : rest - moved;
            pressure = 0;
        } else if (stopAtEdge) {
            rest = BREAK;
        }
        pressure += rest;
        if (pressure >= BREAK && list[i + dir]) {
            i += dir;
            y = list[i][0];
            pressure = 0;
            crossed = true;
        }
        scrollTo(y);
    }

    window.addEventListener("wheel", (e) => {
        if (e.ctrlKey || Math.abs(e.deltaX) > Math.abs(e.deltaY) || e.deltaY === 0) {
            return; // pinch zoom, sideways scroll
        }
        e.preventDefault();
        push(e.deltaY * (e.deltaMode === 1 ? LINE : e.deltaMode === 2 ? window.innerHeight : 1), false);
    }, { passive: false });

    // Touch: the current drag, null when there is none. raw is where the page
    // would be without the resistance past the section edges.
    let touch = null;

    // Scroll position shown for a raw one, and back.
    function resist(raw, lo, hi) {
        return raw > hi ? hi + (raw - hi) * DRAG : raw < lo ? lo + (raw - lo) * DRAG : raw;
    }

    function unresist(y, lo, hi) {
        return y > hi ? hi + (y - hi) / DRAG : y < lo ? lo + (y - lo) / DRAG : y;
    }

    function release() {
        const t = touch;
        touch = null;
        if (!t || !t.dragging) {
            return;
        }
        const [lo, hi] = t.list[t.index];
        // Speed over the last SAMPLE ms, in px/ms (positive: down the page).
        const last = t.samples[t.samples.length - 1];
        const first = t.samples.find((s) => last[0] - s[0] <= SAMPLE) || last;
        const speed = performance.now() - last[0] > SAMPLE || last === first
            ? 0
            : (last[1] - first[1]) / (last[0] - first[0]);
        const past = t.raw > hi ? t.raw - hi : t.raw < lo ? t.raw - lo : 0;
        const dir = Math.sign(past);
        const next = t.list[t.index + dir];
        pressure = 0;
        if (dir && next && (Math.abs(past) > PULL * window.innerHeight || speed * dir > FLICK)) {
            scrollTo(next[0]);
        } else {
            scrollTo(Math.min(hi, Math.max(lo, t.raw + speed * COAST)));
        }
    }

    window.addEventListener("touchstart", (e) => {
        const zoomed = window.visualViewport && window.visualViewport.scale > 1.01;
        if (e.touches.length !== 1 || zoomed) {
            release();
            return;
        }
        const list = screens(panels);
        const index = closest(list, target === null ? window.scrollY : target);
        const finger = e.touches[0];
        touch = {
            id: finger.identifier,
            x: finger.clientX,
            y: finger.clientY,
            list,
            index,
            start: unresist(window.scrollY, ...list[index]),
            raw: 0,
            dragging: false,
            samples: [],
        };
    }, { passive: true });

    window.addEventListener("touchmove", (e) => {
        if (!touch) {
            return;
        }
        const finger = Array.from(e.touches).find((f) => f.identifier === touch.id);
        if (!finger || e.touches.length !== 1) {
            release();
            return;
        }
        const dx = finger.clientX - touch.x;
        const dy = finger.clientY - touch.y;
        if (!touch.dragging) {
            if (Math.hypot(dx, dy) < SLOP) {
                if (e.cancelable) {
                    e.preventDefault(); // keep the browser from starting its own scroll
                }
                return;
            }
            if (Math.abs(dx) > Math.abs(dy) || !e.cancelable) {
                touch = null; // sideways, or the browser already scrolls: its gesture
                return;
            }
            // Catch the page if it was moving.
            cancelAnimationFrame(frame);
            frame = 0;
            target = null;
            root.style.scrollSnapType = "none";
            touch.dragging = true;
        }
        e.preventDefault();
        touch.raw = touch.start - dy;
        touch.samples.push([performance.now(), touch.raw]);
        if (touch.samples.length > 20) {
            touch.samples.shift();
        }
        window.scrollTo({ top: resist(touch.raw, ...touch.list[touch.index]), behavior: "instant" });
    }, { passive: false });

    window.addEventListener("touchend", release);
    window.addEventListener("touchcancel", release);

    // Links to a section: animated like the rest, landing where the wheel would.
    document.addEventListener("click", (e) => {
        if (e.defaultPrevented || e.button !== 0 || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) {
            return;
        }
        const link = e.target.closest("a[href*='#']");
        if (!link || link.target) {
            return;
        }
        const url = new URL(link.href);
        if (url.origin !== location.origin || url.pathname !== location.pathname || url.hash.length < 2) {
            return;
        }
        const el = document.getElementById(decodeURIComponent(url.hash.slice(1)));
        const index = el ? panels.indexOf(el.closest(".hero, .panel")) : -1;
        if (index < 0) {
            return;
        }
        e.preventDefault();
        if (location.hash !== url.hash) {
            history.pushState(null, "", url.hash);
        }
        pressure = 0;
        scrollTo(screens(panels)[index][0]);
    });

    window.addEventListener("keydown", (e) => {
        if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) {
            return;
        }
        const el = document.activeElement;
        if (el && (el.isContentEditable || el.closest("input, textarea, select")
                || (e.key === " " && el.closest("button")))) {
            return; // keys that belong to the focused control
        }
        const page = window.innerHeight * PAGE;
        switch (e.key) {
            case "ArrowDown":
                push(ARROW, true);
                break;
            case "ArrowUp":
                push(-ARROW, true);
                break;
            case "PageDown":
                push(page, true);
                break;
            case "PageUp":
                push(-page, true);
                break;
            case " ":
                push(e.shiftKey ? -page : page, true);
                break;
            case "Home":
                pressure = 0;
                scrollTo(0);
                break;
            case "End":
                pressure = 0;
                scrollTo(root.scrollHeight - window.innerHeight);
                break;
            default:
                return;
        }
        e.preventDefault();
    });
}

const footer = document.querySelector(".site-footer");
if (footer && "ResizeObserver" in window) {
    measureFooter(footer);
}
const panels = Array.from(document.querySelectorAll(".hero, .content > section.panel"));
if (panels.length > 1) {
    mount(panels);
}
