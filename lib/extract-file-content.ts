/**
 * Improved file content extractor that handles common LLM formatting mistakes
 */
export const extractFileContent = (chunk: string, filePath: string): string => {
  if (!chunk) return "";
  
  let content = chunk.trim();
  
  // Remove language marker if it's on the first line (common LLM mistake)
  // e.g., "json\n{...}" or "javascript\nconst x = ..."
  const firstLine = content.split('\n')[0].trim().toLowerCase();
  const knownLanguages = ['json', 'javascript', 'js', 'typescript', 'ts', 'jsx', 'tsx', 'html', 'css', 'python', 'py'];
  if (knownLanguages.includes(firstLine)) {
    content = content.substring(content.indexOf('\n') + 1).trim();
  }
  
  // Try to extract from code fences first (```language ... ```)
  const codeFenceMatch = content.match(/```(?:\w+)?\s*([\s\S]*?)\s*```/);
  if (codeFenceMatch) {
    content = codeFenceMatch[1].trim();
  } else {
    // Remove opening fence if present
    content = content.replace(/^```(?:\w+)?\s*/i, "");
    // Remove closing fence if present
    content = content.replace(/```\s*$/i, "");
  }
  
  // File-type specific handling
  if (filePath.endsWith('.html')) {
    const doctypeMatch = content.match(/<!DOCTYPE html>[\s\S]*/i);
    if (doctypeMatch) {
      content = doctypeMatch[0];
    }
    content = ensureCompleteHtml(content);
  } else if (filePath.endsWith('.json')) {
    // Remove any trailing HTML tags (common LLM mistake)
    content = content.replace(/<\/html>\s*$/i, "").trim();
  }
  
  return content.trim();
};

const ensureCompleteHtml = (html: string): string => {
  let completeHtml = html;
  if (completeHtml.includes("<head>") && !completeHtml.includes("</head>")) {
    completeHtml += "\n</head>";
  }
  if (completeHtml.includes("<body") && !completeHtml.includes("</body>")) {
    completeHtml += "\n</body>";
  }
  if (!completeHtml.includes("</html>")) {
    completeHtml += "\n</html>";
  }
  return completeHtml;
};
