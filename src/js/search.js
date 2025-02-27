// Search functionality
document.addEventListener("DOMContentLoaded", () => {
  const searchInput = document.getElementById("search-input");
  const searchResults = document.getElementById("search-results");
  let searchData = [];

  // Fetch search data
  fetch("/js/search-data.json")
    .then((response) => response.json())
    .then((data) => {
      searchData = data;
    })
    .catch((error) => console.error("Error loading search data:", error));

  // Search input event
  searchInput.addEventListener("input", () => {
    const query = searchInput.value.trim().toLowerCase();

    if (query.length < 2) {
      searchResults.innerHTML = "";
      searchResults.classList.remove("active");
      return;
    }

    // Filter articles based on query
    const filteredResults = searchData
      .filter((article) => {
        return (
          article.title.toLowerCase().includes(query) ||
          article.description.toLowerCase().includes(query) ||
          article.tags.some((tag) => tag.toLowerCase().includes(query))
        );
      })
      .slice(0, 5); // Limit to 5 results

    // Display results
    if (filteredResults.length > 0) {
      searchResults.innerHTML = filteredResults
        .map(
          (result) => `
        <div class="search-result-item">
          <a href="/${result.path}">
            <div class="result-title">${result.title}</div>
            <div class="result-date">${new Date(result.date).toLocaleDateString(
              "en-US",
              { year: "numeric", month: "short", day: "numeric" }
            )}</div>
          </a>
        </div>
      `
        )
        .join("");
      searchResults.classList.add("active");
    } else {
      searchResults.innerHTML =
        '<div class="search-result-item">No results found</div>';
      searchResults.classList.add("active");
    }
  });

  // Close search results when clicking outside
});
