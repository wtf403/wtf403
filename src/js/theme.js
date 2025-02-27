// Theme switching functionality
document.addEventListener("DOMContentLoaded", () => {
  const themeToggle = document.getElementById("theme-toggle");
  const highlightTheme = document.getElementById("highlight-theme");

  // Get saved theme or default to 'auto'
  const savedTheme = localStorage.getItem("theme") || "auto";
  setTheme(savedTheme);

  // Toggle between themes (light -> dark -> auto -> light)
  themeToggle.addEventListener("click", () => {
    const currentTheme =
      document.documentElement.getAttribute("data-theme") || "auto";
    let newTheme;

    switch (currentTheme) {
      case "light":
        newTheme = "dark";
        break;
      case "dark":
        newTheme = "auto";
        break;
      default:
        newTheme = "light";
    }

    setTheme(newTheme);
    localStorage.setItem("theme", newTheme);
  });

  // Set theme and update highlight.js theme
  function setTheme(theme) {
    if (theme === "auto") {
      document.documentElement.removeAttribute("data-theme");
      const prefersDark = window.matchMedia(
        "(prefers-color-scheme: dark)"
      ).matches;
      document.documentElement.setAttribute(
        "data-theme",
        prefersDark ? "dark" : "light"
      );
      updateHighlightTheme(prefersDark ? "dark" : "light");

      // Listen for system theme changes
      window
        .matchMedia("(prefers-color-scheme: dark)")
        .addEventListener("change", (e) => {
          if (localStorage.getItem("theme") === "auto") {
            document.documentElement.setAttribute(
              "data-theme",
              e.matches ? "dark" : "light"
            );
            updateHighlightTheme(e.matches ? "dark" : "light");
          }
        });
    } else {
      document.documentElement.setAttribute("data-theme", theme);
      updateHighlightTheme(theme);
    }
  }

  // Update highlight.js theme based on current theme
  function updateHighlightTheme(theme) {
    const isDark = theme === "dark";
    highlightTheme.href = `https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/${
      isDark ? "github-dark" : "github"
    }.min.css`;
  }
});
