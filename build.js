const fs = require("fs");
const path = require("path");
const { glob } = require("glob");
const { marked } = require("marked");

// Configure marked with syntax highlighting
marked.setOptions({
  highlight: function (code, lang) {
    return code;
  },
  gfm: true,
  breaks: true,
});

// Ensure dist directories exist
if (!fs.existsSync("dist")) {
  fs.mkdirSync("dist");
}
if (!fs.existsSync("dist/articles")) {
  fs.mkdirSync("dist/articles");
}

// Copy static files
fs.copyFileSync("style.css", "dist/style.css");
fs.copyFileSync("script.js", "dist/script.js");

// Read the template
const templateHtml = fs.readFileSync("index.html", "utf8");

// Process markdown files
async function buildSite() {
  const markdownFiles = await glob("articles/*.md");
  const articles = [];

  for (const file of markdownFiles) {
    const content = fs.readFileSync(file, "utf8");
    const fileName = path.basename(file, ".md");

    // Extract title from first heading
    let title = fileName;
    const titleMatch = content.match(/^#\s+(.+)$/m);
    if (titleMatch) {
      title = titleMatch[1];
    }

    // Extract date from filename or use current date
    let date = new Date().toISOString().split("T")[0];
    const dateMatch = fileName.match(/^(\d{4}-\d{2}-\d{2})/);
    if (dateMatch) {
      date = dateMatch[1];
    }

    // Convert markdown to HTML
    const htmlContent = marked.parse(content);

    // Create HTML file
    const htmlFileName = `${fileName}.html`;
    const htmlFilePath = path.join("dist/articles", htmlFileName);

    // Replace content in template
    let articleHtml = templateHtml
      .replace(/<title>.*?<\/title>/, `<title>${title}</title>`)
      .replace(
        /<main.*?>([\s\S]*?)<\/main>/,
        `<main class="container">
        <article class="article">
          <header class="article-header">
            <h1>${title}</h1>
            <div class="article-meta">
              <time datetime="${date}">${new Date(date).toLocaleDateString(
          "en-US",
          { year: "numeric", month: "long", day: "numeric" }
        )}</time>
            </div>
          </header>
          <div class="article-content">
            ${htmlContent}
          </div>
        </article>
      </main>`
      );

    fs.writeFileSync(htmlFilePath, articleHtml);

    // Add to articles list
    articles.push({
      title,
      date,
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
    </article>
  `
    )
    .join("");

  // Replace content in template for index
  let indexHtml = templateHtml.replace(
    /<main.*?>([\s\S]*?)<\/main>/,
    `<main class="container">
      <section class="articles-list">
        <h1>Articles</h1>
        ${articlesHtml}
      </section>
    </main>`
  );

  fs.writeFileSync("dist/index.html", indexHtml);

  // Generate search data
  fs.writeFileSync("dist/search-data.json", JSON.stringify(articles));

  console.log(`Built site with ${articles.length} articles`);
}

// Run the build
buildSite().catch(console.error);
