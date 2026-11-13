/*
 * Projects carousel
 *
 * Turns the grid of project cards (_includes/project-carousel.html) into a
 * row of tall bars, macOS dock style: with a mouse, the bars grow as the
 * pointer comes near, with a smooth falloff over --carousel-influence px. A
 * click or tap (or Enter on the title, which becomes a button) opens a bar
 * into a large card with the text, the others shrink to blurred strips; a
 * click outside, a second click or Escape closes it.
 *
 * Sizes come from the --carousel-* properties set in
 * _sass/project-carousel.scss. Each frame eases the sizes toward their
 * targets, and the loop stops as soon as they are reached: nothing runs
 * while the mouse is elsewhere. With prefers-reduced-motion, bars don't
 * grow under the mouse and open without easing.
 */

const EASE = 12;        // easing rate, 1/s: higher is snappier
const SPREAD = 2.5;     // about how many bars grow at once, to fit the row

const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)");

function smoothstep(x) {
    const t = Math.min(Math.max(x, 0), 1);
    return t * t * (3 - 2 * t);
}

function mount(list) {
    const cards = Array.from(list.querySelectorAll(".project-card"));
    if (cards.length === 0) {
        return;
    }
    const n = cards.length;
    const toggles = cards.map((card) => {
        const title = card.querySelector(".project-title");
        const body = card.querySelector(".project-body");
        const button = document.createElement("button");
        button.type = "button";
        button.className = "project-toggle";
        button.textContent = title.textContent.trim();
        button.setAttribute("aria-expanded", "false");
        button.setAttribute("aria-controls", body.id);
        title.replaceChildren(button);
        card.dataset.title = button.textContent;
        return button;
    });
    list.classList.add("is-magnetic");

    let config = null;
    let open = -1;
    let pointer = null;   // x of the mouse from the middle of the row, or null
    let frame = 0;
    let last = 0;
    const size = cards.map(() => ({ w: 0, h: 0 }));

    function readConfig() {
        const style = getComputedStyle(list);
        const px = (name) => parseFloat(style.getPropertyValue(`--carousel-${name}`)) || 0;
        config = {
            barW: px("bar-width"),
            barH: px("bar-height"),
            hoverW: px("hover-width"),
            hoverH: px("hover-height"),
            openW: px("open-width"),
            openH: px("open-height"),
            strip: px("strip-width"),
            gap: px("gap"),
            influence: px("influence"),
        };
    }

    // Narrows the bars when the row would not fit in the column.
    function fit() {
        const c = config;
        const room = list.clientWidth - (n - 1) * c.gap;
        const need = n * c.barW + Math.min(n, SPREAD) * (c.hoverW - c.barW);
        return Math.min(1, room / need);
    }

    // Middle of bar i at rest, from the middle of the row.
    function restCenter(i, scale) {
        return (i - (n - 1) / 2) * (config.barW * scale + config.gap);
    }

    function targets() {
        const c = config;
        if (open >= 0) {
            const width = Math.max(
                c.barW,
                Math.min(c.openW, list.clientWidth - (n - 1) * (c.strip + c.gap))
            );
            return cards.map((_, i) => (i === open
                ? { w: width, h: c.openH }
                : { w: c.strip, h: c.barH }));
        }
        const scale = fit();
        return cards.map((_, i) => {
            let t = 0;
            if (pointer !== null && c.influence > 0) {
                t = 1 - smoothstep(Math.abs(pointer - restCenter(i, scale)) / c.influence);
            }
            return {
                w: (c.barW + (c.hoverW - c.barW) * t) * scale,
                h: c.barH + (c.hoverH - c.barH) * t,
            };
        });
    }

    function apply() {
        cards.forEach((card, i) => {
            card.style.setProperty("--w", `${size[i].w.toFixed(2)}px`);
            card.style.setProperty("--h", `${size[i].h.toFixed(2)}px`);
        });
    }

    function tick(now) {
        const dt = Math.min((now - last) / 1000, 0.1);
        last = now;
        const k = reduceMotion.matches ? 1 : 1 - Math.exp(-EASE * dt);
        const goal = targets();
        let moving = false;
        size.forEach((s, i) => {
            s.w += (goal[i].w - s.w) * k;
            s.h += (goal[i].h - s.h) * k;
            if (Math.abs(goal[i].w - s.w) > 0.2 || Math.abs(goal[i].h - s.h) > 0.2) {
                moving = true;
            } else {
                s.w = goal[i].w;
                s.h = goal[i].h;
            }
        });
        apply();
        frame = moving ? requestAnimationFrame(tick) : 0;
    }

    function kick() {
        if (!frame) {
            last = performance.now();
            frame = requestAnimationFrame(tick);
        }
    }

    function setOpen(i) {
        open = i;
        list.classList.toggle("has-open", open >= 0);
        cards.forEach((card, j) => {
            card.classList.toggle("is-open", j === open);
            toggles[j].setAttribute("aria-expanded", String(j === open));
        });
        kick();
    }

    // The mouse, relative to the middle of the row
    list.addEventListener("pointermove", (event) => {
        if (event.pointerType !== "mouse" || !finePointer.matches || reduceMotion.matches) {
            return;
        }
        const rect = list.getBoundingClientRect();
        pointer = event.clientX - (rect.left + rect.width / 2);
        kick();
    });
    list.addEventListener("pointerleave", () => {
        pointer = null;
        kick();
    });

    // A keyboard focus grows its bar as the mouse would.
    list.addEventListener("focusin", (event) => {
        const i = toggles.indexOf(event.target);
        if (i >= 0 && event.target.matches(":focus-visible") && !reduceMotion.matches) {
            pointer = restCenter(i, fit());
            kick();
        }
    });
    list.addEventListener("focusout", (event) => {
        if (!list.contains(event.relatedTarget)) {
            pointer = null;
            kick();
        }
    });

    cards.forEach((card, i) => {
        card.addEventListener("click", (event) => {
            // Links and selected text in an opened card stay usable.
            if (event.target.closest("a") || (open === i && event.target.closest(".project-body"))) {
                return;
            }
            setOpen(open === i ? -1 : i);
        });
    });

    document.addEventListener("click", (event) => {
        if (open >= 0 && !list.contains(event.target)) {
            setOpen(-1);
        }
    });
    document.addEventListener("keydown", (event) => {
        if (event.key === "Escape" && open >= 0) {
            const i = open;
            setOpen(-1);
            if (list.contains(document.activeElement)) {
                toggles[i].focus();
            }
        }
    });

    new ResizeObserver(() => {
        readConfig();
        kick();
    }).observe(list);

    readConfig();
    targets().forEach((goal, i) => {
        size[i].w = goal.w;
        size[i].h = goal.h;
    });
    apply();
}

const list = document.querySelector(".project-carousel");
if (list) {
    mount(list);
}
