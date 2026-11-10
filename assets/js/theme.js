/*
 * Light/dark theme switch
 *
 * Loaded as a classic (blocking) script in <head>, so that the saved theme is
 * applied before the first paint, without a flash of the light theme. The
 * page starts light; the visitor's choice is kept in localStorage. The
 * switches ([data-theme-toggle]: .theme-toggle in _includes/theme-toggle.html,
 * and the theme row of the small-screen menu) are shown once the page is
 * parsed. Being the first script to run, it also marks <html class="js">, so
 * the CSS can hide what JS replaces (the hero links, behind the menu) before
 * the first paint. The relief (domain-warp-header.js) watches data-theme on <html>
 * and redraws itself.
 */
(function () {
    var KEY = "theme";
    var root = document.documentElement;
    root.classList.add("js");

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
        var buttons = document.querySelectorAll("[data-theme-toggle]");
        function sync() {
            var dark = root.getAttribute("data-theme") === "dark";
            buttons.forEach(function (button) {
                // Icon-only switch; the menu row has a visible label instead
                if (button.hasAttribute("aria-label")) {
                    button.setAttribute("aria-label", dark ? "Switch to light mode" : "Switch to dark mode");
                }
            });
        }
        buttons.forEach(function (button) {
            button.addEventListener("click", function () {
                var next = root.getAttribute("data-theme") === "dark" ? "light" : "dark";
                apply(next);
                save(next);
                sync();
            });
            button.hidden = false;
        });
        sync();
    });
})();
