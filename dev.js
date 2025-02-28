const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
const chokidar = require("chokidar");
const browserSync = require("browser-sync").create();

// MIME types for different file extensions
const MIME_TYPES = {
  ".html": "text/html",
  ".css": "text/css",
  ".js": "text/javascript",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".xml": "application/xml",
};

// Initial build
console.log("Building site...");
execSync("node build.js", { stdio: "inherit" });

// Function to handle CSS processing
function processCssFiles() {
  console.log("Processing CSS files...");
  try {
    execSync("npx postcss src/style.css -o dist/style.css", { stdio: "inherit" });
    execSync("npx postcss src/light.css -o dist/light.css", { stdio: "inherit" });
    execSync("npx postcss src/dark.css -o dist/dark.css", { stdio: "inherit" });
    console.log("CSS processing complete");
    return true;
  } catch (error) {
    console.error("Error processing CSS:", error);
    return false;
  }
}

// Function to handle full site build
function rebuildSite() {
  console.log("Rebuilding site...");
  try {
    execSync("node build.js", { stdio: "inherit" });
    console.log("Site rebuild complete");
    return true;
  } catch (error) {
    console.error("Error rebuilding site:", error);
    return false;
  }
}

// Function to copy media file
function copyMediaFile(file) {
  try {
    const filename = path.basename(file);
    fs.copyFileSync(file, path.join("dist/media", filename));
    console.log(`Copied media file: ${filename}`);
    return true;
  } catch (error) {
    console.error(`Error copying media file ${file}:`, error);
    return false;
  }
}

// Initialize Browser-Sync
browserSync.init({
  server: {
    baseDir: "./dist",
    serveStaticOptions: {
      extensions: ["html"],
    },
  },
  port: 3000,
  ui: false,
  logLevel: "info",
  logPrefix: "DevServer",
  notify: false,
  open: false,
  ghostMode: false,
  snippetOptions: {
    rule: {
      match: /<\/body>/i,
      fn: function (snippet, match) {
        return snippet + match;
      },
    },
  },
  middleware: [
    (req, res, next) => {
      // Set cache-control headers for all responses
      const ext = path.extname(req.url || "");
      if (ext === ".css") {
        res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
        res.setHeader("Pragma", "no-cache");
        res.setHeader("Expires", "0");
      }
      next();
    },
  ],
});

// Set up file watching with specific handlers for each file type
const cssWatcher = chokidar.watch("src/*.css", {
  ignored: [/(^|[\/\\])\../, /node_modules/, /dist/],
  persistent: true,
  ignoreInitial: true,
  awaitWriteFinish: { stabilityThreshold: 100, pollInterval: 100 },
});

const mdWatcher = chokidar.watch("articles/*.md", {
  ignored: [/(^|[\/\\])\../, /node_modules/, /dist/],
  persistent: true,
  ignoreInitial: true,
  awaitWriteFinish: { stabilityThreshold: 100, pollInterval: 100 },
});

const templateWatcher = chokidar.watch("src/*.html", {
  ignored: [/(^|[\/\\])\../, /node_modules/, /dist/],
  persistent: true,
  ignoreInitial: true,
  awaitWriteFinish: { stabilityThreshold: 100, pollInterval: 100 },
});

const mediaWatcher = chokidar.watch("media/*", {
  ignored: [/(^|[\/\\])\../, /node_modules/, /dist/],
  persistent: true,
  ignoreInitial: true,
  awaitWriteFinish: { stabilityThreshold: 100, pollInterval: 100 },
});

// CSS file changes
cssWatcher.on("change", (file) => {
  console.log(`CSS file changed: ${file}`);
  if (processCssFiles()) {
    // Explicitly reload CSS files
    browserSync.reload("*.css");
  }
});

// Markdown file changes
mdWatcher.on("change", (file) => {
  console.log(`Markdown file changed: ${file}`);
  if (rebuildSite()) {
    browserSync.reload();
  }
});

// Template file changes
templateWatcher.on("change", (file) => {
  console.log(`Template file changed: ${file}`);
  if (rebuildSite()) {
    browserSync.reload();
  }
});

// Media file changes
mediaWatcher.on("change", (file) => {
  console.log(`Media file changed: ${file}`);
  if (copyMediaFile(file)) {
    browserSync.reload();
  }
});

// Also handle added files
cssWatcher.on("add", (file) => {
  console.log(`CSS file added: ${file}`);
  if (processCssFiles()) {
    browserSync.reload("*.css");
  }
});

mdWatcher.on("add", (file) => {
  console.log(`Markdown file added: ${file}`);
  if (rebuildSite()) {
    browserSync.reload();
  }
});

mediaWatcher.on("add", (file) => {
  console.log(`Media file added: ${file}`);
  if (copyMediaFile(file)) {
    browserSync.reload();
  }
});

// Watch the dist directory directly for any changes that might not be caught by the build process
const distWatcher = chokidar.watch("dist/**/*.{html,css,js}", {
  ignored: /(^|[\/\\])\../,
  persistent: true,
  ignoreInitial: true,
  awaitWriteFinish: { stabilityThreshold: 300, pollInterval: 100 },
});

distWatcher.on("change", (file) => {
  console.log(`Dist file changed: ${file}`);
  const ext = path.extname(file);
  if (ext === ".css") {
    browserSync.reload("*.css");
  } else {
    browserSync.reload();
  }
});

console.log(`Development server running at http://localhost:3000`);
console.log("Watching for changes...");
