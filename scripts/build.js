const fs = require("fs");
const path = require("path");
const { glob } = require("glob");
const { marked } = require("marked");
const frontMatter = require("front-matter");
const { execSync } = require("child_process");

marked.setOptions({
  gfm: true,
  breaks: true,
  pedantic: false,
  smartLists: true,
  smartypants: false,
});

const originalCode = marked.Renderer.prototype.code;
marked.Renderer.prototype.code = function (code, language, escaped) {
  let html = originalCode.call(this, code, language, escaped);
  if (language) {
    html = html.replace("<pre>", `<pre data-lang="${language}">`);
  }
  return html;
};

function estimateReadingTime(text) {
  const wordsPerMinute = 200;
  const words = text.trim().split(/\s+/).length;
  const minutes = Math.ceil(words / wordsPerMinute);
  return minutes;
}

if (!fs.existsSync("dist")) {
  fs.mkdirSync("dist");
}

if (!fs.existsSync("dist/media")) {
  fs.mkdirSync("dist/media");
}

const srcFiles = fs.readdirSync("src");
for (const file of srcFiles) {
  if (file !== "index.html") {
    fs.copyFileSync(path.join("src", file), path.join("dist", file));
  }
}

if (fs.existsSync("media")) {
  const mediaFiles = fs.readdirSync("media");
  for (const file of mediaFiles) {
    fs.copyFileSync(path.join("media", file), path.join("dist/media", file));
  }
}

try {
  execSync("npx postcss src/style.css -o dist/style.css", { stdio: "inherit" });
  execSync("npx postcss src/light.css -o dist/light.css", { stdio: "inherit" });
  execSync("npx postcss src/dark.css -o dist/dark.css", { stdio: "inherit" });
} catch (error) {
  console.error("Error processing CSS:", error);
}

const templateHtml = fs.readFileSync("src/index.html", "utf8");

const createStatComponent = (icon, text) => `
  <span>
    <svg style="margin-bottom:-3px" viewBox="0 0 32 32" width="16" height="16" fill="none" stroke="currentcolor" stroke-linecap="round" stroke-linejoin="round" stroke-width="6.25%">
      ${icon}
    </svg>
    ${text}
  </span>`;

const clockIcon =
  '<circle cx="16" cy="16" r="14"></circle><path d="M16 8 L16 16 20 20"></path>';
const editIcon =
  '<path d="M30 7 L25 2 5 22 3 29 10 27 Z M21 6 L26 11 Z M5 22 L10 27 Z"></path>';

async function buildSite() {
  const markdownFiles = await glob("articles/*.md");
  const articles = [];

  for (const file of markdownFiles) {
    if (path.basename(file).startsWith(".")) {
      continue;
    }

    const fileContent = fs.readFileSync(file, "utf8");
    const { attributes, body } = frontMatter(fileContent);
    const fileName = path.basename(file, ".md");
    const content = body;

    let title = fileName;
    const titleMatch = content.match(/^#\s+(.+)$/m);
    if (titleMatch) {
      title = titleMatch[1];
    }

    let date = attributes.date || new Date().toISOString().split("T")[0];
    if (!attributes.date) {
      const dateMatch = fileName.match(/^(\d{4}-\d{2}-\d{2})/);
      if (dateMatch) {
        date = dateMatch[1];
      }
    }

    const formattedDate = new Date(date).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    const abstract = attributes.abstract || "";

    const htmlAbstract = abstract ? marked.parse(abstract).trim() : "";

    let description = "";
    const descMatch = content
      .replace(/^#\s+.+$/m, "")
      .match(/^\s*(.+?)(?:\n\n|\n$)/);
    if (descMatch) {
      description = descMatch[1].trim();
    }

    const readingTime = estimateReadingTime(content);

    const htmlContent = marked.parse(content);

    const htmlFileName = `${fileName}.html`;
    const htmlFilePath = path.join("dist", htmlFileName);

    let articleHtml = templateHtml
      .replace(/<title>.*?<\/title>/, `<title>${title} - wtf403.xyz</title>`)
      .replace(
        /<main.*?>([\s\S]*?)<\/main>/,
        `<main>
          <article>
            <header>
              ${htmlAbstract ? htmlAbstract : ""}
              <div class="stats">
                ${createStatComponent(clockIcon, `${readingTime} minute read`)}
                ${createStatComponent(editIcon, `Published: ${formattedDate}`)}
              </div>
            </header>
            <div>${htmlContent}</div>
          </article>
        </main>`
      );

    fs.writeFileSync(htmlFilePath, articleHtml);

    articles.push({
      title,
      date,
      description,
      abstract,
      path: htmlFileName,
      readingTime,
    });
  }

  articles.sort((a, b) => new Date(b.date) - new Date(a.date));

  const articlesHtml = articles
    .map(
      (article) => `
    <article>
      <h1><a class="external" href="${article.path}">${article.title}</a></h1>
      ${article.abstract ? `<p>${article.abstract}</p>` : ""}
      <div class="stats">
        ${createStatComponent(clockIcon, `${article.readingTime} minute read`)}
        ${createStatComponent(
          editIcon,
          `Published: ${new Date(article.date).toLocaleDateString("en-US", {
            year: "numeric",
            month: "long",
            day: "numeric",
          })}`
        )}
      </div>
    </article>
  `
    )
    .join("");

  const indexHtml = templateHtml.replace(
    /<main.*?>([\s\S]*?)<\/main>/,
    `<main class="articles">
      ${articlesHtml}
    </main>`
  );

  fs.writeFileSync("dist/index.html", indexHtml);

  let rssContent = `<rss xmlns:atom="http://www.w3.org/2005/Atom" version="2.0" >
<channel>
<title>wtf403.xyz</title>
<link>https://wtf403.xyz/</link>
<description>wtf403 blog</description>
<atom:link href="https://wtf403.xyz/feed.xml" rel="self" type="application/rss+xml"/>
<language>en-us</language>`;

  // Function to escape XML special characters
  const escapeXml = (unsafe) => {
    if (!unsafe) return "";
    return unsafe
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&apos;");
  };

  for (const article of articles) {
    const pubDate = new Date(article.date).toUTCString();
    const articleUrl = `https://wtf403.xyz/${article.path}`;

    rssContent += `
<item>
<title>${escapeXml(article.title)}</title>
<link>${articleUrl}</link>
<guid>${articleUrl}</guid>
<pubDate>${pubDate}</pubDate>
<description>${escapeXml(article.abstract || "")}</description>
</item>`;
  }

  rssContent += `
</channel>
</rss>`;

  fs.writeFileSync("dist/feed.xml", rssContent);
}

buildSite().catch((error) => {
  console.error("Error building site:", error);
  process.exit(1);
});
