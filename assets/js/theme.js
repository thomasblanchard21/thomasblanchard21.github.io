/*
 * Light/dark theme switch
 *
 * Loaded as a classic (blocking) script in <head>, so that the saved theme is
 * applied before the first paint, without a flash of the light theme. The
 * page starts light; the visitor's choice is kept in localStorage. The
 * button (.theme-toggle, _includes/theme-toggle.html) is shown once the page
 * is parsed. The relief (domain-warp-header.js) watches data-theme on <html>
 * and redraws itself.
 */
(function () {
    var KEY = "theme";
    var root = document.documentElement;

    function load() {
        try {
            return localStorage.getItem(KEY);
        } catch (err) {
            return null;
        }
    }

    function save(theme) {
        try {
            if (theme === "dark") {
                localStorage.setItem(KEY, "dark");
            } else {
                localStorage.removeItem(KEY);
            }
        } catch (err) {
            // Storage blocked: the choice lasts for this page view only.
        }
    }

    function apply(theme) {
        if (theme === "dark") {
            root.setAttribute("data-theme", "dark");
        } else {
            root.removeAttribute("data-theme");
        }
    }

    apply(load());

    document.addEventListener("DOMContentLoaded", function () {
        var button = document.querySelector(".theme-toggle");
        if (!button) {
            return;
        }
        function sync() {
            var dark = root.getAttribute("data-theme") === "dark";
            button.setAttribute("aria-label", dark ? "Switch to light mode" : "Switch to dark mode");
        }
        button.addEventListener("click", function () {
            var next = root.getAttribute("data-theme") === "dark" ? "light" : "dark";
            apply(next);
            save(next);
            sync();
        });
        sync();
        button.hidden = false;
    });
})();
