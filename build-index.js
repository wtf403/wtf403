const fs = require("fs");
const path = require("path");
const { glob } = require("glob");
const frontMatter = require("front-matter");

// Ensure dist directory exists
if (!fs.existsSync("dist")) {
  fs.mkdirSync("dist");
}
if (!fs.existsSync("dist/articles")) {
  fs.mkdirSync("dist/articles");
}

// Copy static files
fs.copyFileSync("style.css", "dist/style.css");
fs.copyFileSync("script.js", "dist/script.js");

// Process markdown files to extract metadata
async function buildIndex() {
  const markdownFiles = await glob("articles/*.md");
  const articles = [];

  for (const file of markdownFiles) {
    const content = fs.readFileSync(file, "utf8");
    const { attributes } = frontMatter(content);

    const fileName = path.basename(file, ".md");
    const htmlFileName = `${fileName}.html`;

    articles.push({
      title: attributes.title || fileName,
      date: attributes.date || new Date().toISOString().split("T")[0],
      description: attributes.description || "",
      tags: attributes.tags || [],
      path: `articles/${htmlFileName}`,
    });
  }

  // Sort articles by date (newest first)
  articles.sort((a, b) => new Date(b.date) - new Date(a.date));

  // Generate index page
  const articlesHtml = articles
    .map(
      (article) => `
    <article class="article-card">
      <h2><a href="${article.path}">${article.title}</a></h2>
      <div class="article-meta">
        <time datetime="${article.date}">${new Date(
        article.date
      ).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })}</time>
      </div>
      ${
        article.description
          ? `<p class="article-description">${article.description}</p>`
          : ""
      }
    </article>
  `
    )
    .join("");

  const indexHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>wtf403.eth</title>
  <link rel="stylesheet" href="/style.css">
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/highlight.js@11.9.0/styles/github.min.css" id="highlight-theme">
</head>
<body>
  <header>
    <div class="container">
      <div class="header-left">
        <a href="/" class="site-title">wtf403.eth</a>
      </div>
      <div class="header-right">
        <div class="search-container">
          <input type="text" id="search-input" placeholder="Search articles...">
          <div id="search-results" class="search-results"></div>
        </div>
        <button id="theme-toggle" class="theme-toggle" aria-label="Toggle theme">
          <span class="theme-icon">🌞</span>
        </button>
      </div>
    </div>
  </header>

  <main class="container">
    <section class="articles-list">
      <h1>Articles</h1>
      ${articlesHtml}
    </section>
  </main>

  <footer class="container">
    <p>&copy; 2023 wtf403.eth</p>
  </footer>

  <script src="/script.js"></script>
</body>
</html>`;

  fs.writeFileSync("dist/index.html", indexHtml);

  // Generate search data
  fs.writeFileSync("dist/search-data.json", JSON.stringify(articles));

  console.log(`Built index page with ${articles.length} articles`);
}

buildIndex().catch(console.error);
