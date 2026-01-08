import { FileNode } from "@/types/types";

/**
 * Finds a file node by name recursively in the file tree
 */
function findFileByName(nodes: FileNode[], name: string): FileNode | null {
  for (const node of nodes) {
    if (node.name === name && !node.children) {
      return node;
    }
    if (node.children) {
      const found = findFileByName(node.children, name);
      if (found) return found;
    }
  }
  return null;
}

/**
 * Finds all files with a specific extension recursively
 */
function findFilesByExtension(nodes: FileNode[], ext: string): FileNode[] {
  const results: FileNode[] = [];
  for (const node of nodes) {
    if (!node.children && node.name.endsWith(ext)) {
      results.push(node);
    }
    if (node.children) {
      results.push(...findFilesByExtension(node.children, ext));
    }
  }
  return results;
}

/**
 * Builds a single HTML file from separate HTML, CSS, and JS files
 * for simple-web framework projects
 */
export function buildSimpleWebHtml(
  files: FileNode[],
  entrypoint?: string
): string {
  // Find the HTML entrypoint
  const htmlFileName = entrypoint || "index.html";
  const htmlFile = findFileByName(files, htmlFileName);

  if (!htmlFile || !htmlFile.content) {
    // Fallback: try to find any .html file
    const htmlFiles = findFilesByExtension(files, ".html");
    if (htmlFiles.length === 0 || !htmlFiles[0].content) {
      return "<html><body><h1>No HTML file found</h1></body></html>";
    }
    return buildCombinedHtml(htmlFiles[0].content, files);
  }

  return buildCombinedHtml(htmlFile.content, files);
}

/**
 * Combines HTML content with inline CSS and JS
 */
function buildCombinedHtml(htmlContent: string, files: FileNode[]): string {
  let result = htmlContent;

  // Find all CSS files and inline them
  const cssFiles = findFilesByExtension(files, ".css");
  for (const cssFile of cssFiles) {
    if (cssFile.content) {
      // Replace <link rel="stylesheet" href="..."> with inline <style>
      const linkRegex = new RegExp(
        `<link[^>]*href=["']${escapeRegex(cssFile.name)}["'][^>]*>`,
        "gi"
      );
      if (linkRegex.test(result)) {
        result = result.replace(
          linkRegex,
          `<style>\n${cssFile.content}\n</style>`
        );
      } else {
        // Also try matching with path like ./style.css or style.css
        const altLinkRegex = new RegExp(
          `<link[^>]*href=["'](\\.\\/)?(.*\\/)?${escapeRegex(cssFile.name)}["'][^>]*>`,
          "gi"
        );
        result = result.replace(
          altLinkRegex,
          `<style>\n${cssFile.content}\n</style>`
        );
      }
    }
  }

  // Find all JS files and inline them
  const jsFiles = findFilesByExtension(files, ".js");
  for (const jsFile of jsFiles) {
    if (jsFile.content) {
      // Replace <script src="..."></script> with inline <script>
      const scriptRegex = new RegExp(
        `<script[^>]*src=["']${escapeRegex(jsFile.name)}["'][^>]*>\\s*</script>`,
        "gi"
      );
      if (scriptRegex.test(result)) {
        result = result.replace(
          scriptRegex,
          `<script>\n${jsFile.content}\n</script>`
        );
      } else {
        // Also try matching with path like ./script.js or script.js
        const altScriptRegex = new RegExp(
          `<script[^>]*src=["'](\\.\\/)?(.*\\/)?${escapeRegex(jsFile.name)}["'][^>]*>\\s*</script>`,
          "gi"
        );
        result = result.replace(
          altScriptRegex,
          `<script>\n${jsFile.content}\n</script>`
        );
      }
    }
  }

  return result;
}

/**
 * Escapes special regex characters in a string
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
