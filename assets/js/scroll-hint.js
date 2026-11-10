/*
 * Scroll hint
 *
 * Fades in the "Scroll" hint at the bottom of the hero (.scroll-hint, see
 * _includes/hero.html) after DELAY ms without input, while the page is at
 * the top. Any input (wheel, key, touch, click) restarts the wait; once the
 * page has been scrolled, the hint is gone for good.
 */

const DELAY = 4000;

function mount(hint) {
    let timer = 0;
    let done = false;

    function hide() {
        hint.classList.remove("is-visible");
    }

    function wait() {
        clearTimeout(timer);
        if (done) {
            return;
        }
        timer = setTimeout(() => {
            if (window.scrollY < 2) {
                hint.classList.add("is-visible");
            }
        }, DELAY);
    }

    function onInput() {
        hide();
        wait();
    }

    function onScroll() {
        if (window.scrollY >= 2) {
            done = true;
            clearTimeout(timer);
            hide();
            for (const type of ["wheel", "keydown", "touchstart", "pointerdown"]) {
                window.removeEventListener(type, onInput);
            }
            window.removeEventListener("scroll", onScroll);
        }
    }

    for (const type of ["wheel", "keydown", "touchstart", "pointerdown"]) {
        window.addEventListener(type, onInput, { passive: true });
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    wait();
}

const hint = document.querySelector(".scroll-hint");
if (hint) {
    mount(hint);
}
