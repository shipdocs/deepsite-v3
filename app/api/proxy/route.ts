import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  // Get the target URL from query parameter
  const targetUrl = req.nextUrl.searchParams.get("url");
  
  if (!targetUrl) {
    return NextResponse.json(
      { error: "Missing 'url' query parameter" },
      { status: 400 }
    );
  }

  try {
    // Parse the target URL
    const url = new URL(targetUrl);
    
    // Only allow static.hf.space domains for security
    if (!url.hostname.endsWith(".static.hf.space")) {
      return NextResponse.json(
        { error: "Only static.hf.space domains are allowed" },
        { status: 403 }
      );
    }

    // Use the pathname from the URL query param, or "/" for root
    const targetPath = url.pathname || "/";
    
    // Merge query parameters from the request URL with the target URL's search params
    const requestSearchParams = req.nextUrl.searchParams;
    const targetSearchParams = new URLSearchParams(url.search);
    
    // Copy all query params except 'url' to the target URL
    requestSearchParams.forEach((value, key) => {
      if (key !== "url") {
        targetSearchParams.set(key, value);
      }
    });
    
    const searchString = targetSearchParams.toString();
    const fullTargetUrl = `${url.protocol}//${url.hostname}${targetPath}${searchString ? `?${searchString}` : ""}`;

    // Fetch the content from the target URL
    const response = await fetch(fullTargetUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; DeepSite/1.0)",
      },
      redirect: "follow", // Follow redirects automatically
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: `Failed to fetch: ${response.statusText}` },
        { status: response.status }
      );
    }

    let contentType = response.headers.get("content-type") || "";
    const content = await response.text();

    // Detect content type from URL path if not properly set
    if (!contentType || contentType === "text/plain" || contentType === "application/octet-stream") {
      const urlPath = url.pathname || "";
      const fileExtension = urlPath.split(".").pop()?.toLowerCase();
      
      if (fileExtension === "js") {
        contentType = "application/javascript";
      } else if (fileExtension === "css") {
        contentType = "text/css";
      } else if (fileExtension === "html" || fileExtension === "htm") {
        contentType = "text/html";
      } else if (fileExtension === "json") {
        contentType = "application/json";
      }
    }

    // Get the base proxy URL
    const requestUrl = new URL(req.url);
    const proxyIndex = requestUrl.pathname.indexOf("/api/proxy");
    const basePath = proxyIndex > 0 ? requestUrl.pathname.substring(0, proxyIndex) : "";
    const proxyBaseUrl = `${basePath}/api/proxy`;
    // Build the base target URL with the path included
    const baseTargetUrl = `https://${url.hostname}${targetPath}`;
    const targetUrlParam = `?url=${encodeURIComponent(baseTargetUrl)}`;

    // Rewrite URLs in HTML content
    let processedContent = content;
    
    if (contentType.includes("text/html")) {
      // Rewrite relative URLs and URLs pointing to the same domain
      processedContent = rewriteUrls(
        content,
        url.hostname,
        proxyBaseUrl,
        baseTargetUrl,
        [] // Empty path segments for root route
      );
      
      // Inject script to intercept JavaScript-based navigation
      processedContent = injectNavigationInterceptor(
        processedContent,
        url.hostname,
        proxyBaseUrl,
        targetUrlParam
      );
    } else if (contentType.includes("text/css")) {
      // Rewrite URLs in CSS
      processedContent = rewriteCssUrls(
        content,
        url.hostname,
        proxyBaseUrl,
        targetUrlParam
      );
    } else if (contentType.includes("application/javascript") || contentType.includes("text/javascript")) {
      // For component files and most JavaScript, don't rewrite URLs
      // Only rewrite if needed (for fetch calls, etc.)
      // Most component JavaScript files don't need URL rewriting
      // Only rewrite if the file contains fetch calls with relative URLs
      if (content.includes("fetch(") && content.match(/fetch\(["'][^"']*[^\/]\./)) {
        processedContent = rewriteJsUrls(
          content,
          url.hostname,
          proxyBaseUrl,
          targetUrlParam
        );
      } else {
        // Don't modify component JavaScript files - they should work as-is
        processedContent = content;
      }
    }

    // Ensure JavaScript files have charset specified
    let finalContentType = contentType;
    if (contentType.includes("javascript") && !contentType.includes("charset")) {
      finalContentType = contentType.includes(";") 
        ? contentType + "; charset=utf-8"
        : contentType + "; charset=utf-8";
    }

    // Return the processed content with appropriate headers
    return new NextResponse(processedContent, {
      status: 200,
      headers: {
        "Content-Type": finalContentType,
        "X-Content-Type-Options": "nosniff",
        // Don't set X-Frame-Options for JavaScript files - they need to execute
        ...(contentType.includes("text/html") && { "X-Frame-Options": "SAMEORIGIN" }),
        // Remove CORS restrictions since we're proxying
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    });
  } catch (error: any) {
    console.error("Proxy error:", error);
    return NextResponse.json(
      { error: error.message || "Proxy error occurred" },
      { status: 500 }
    );
  }
}

// Import the helper functions from the catch-all route
// We'll need to move these to a shared file or duplicate them here
// For now, let's duplicate them to avoid refactoring

function rewriteUrls(
  html: string,
  targetHost: string,
  proxyBaseUrl: string,
  baseTargetUrl: string,
  currentPathSegments: string[] = []
): string {
  let processed = html;

  // Get the current directory path for resolving relative URLs
  const currentDir = currentPathSegments.length > 0 
    ? "/" + currentPathSegments.slice(0, -1).join("/") + "/"
    : "/";

  // Helper function to build proxy URL with path in query parameter
  const buildProxyUrl = (path: string, search?: string) => {
    const fullTargetUrl = `https://${targetHost}${path}`;
    const encodedUrl = encodeURIComponent(fullTargetUrl);
    const searchPart = search ? `&${search}` : "";
    return `${proxyBaseUrl}?url=${encodedUrl}${searchPart}`;
  };

  // Rewrite relative URLs in href attributes
  processed = processed.replace(
    /href=["']([^"']+)["']/gi,
    (match, urlStr) => {
      if (urlStr.startsWith("http://") || urlStr.startsWith("https://")) {
        // Absolute URL - rewrite if it's the same domain
        try {
          const urlObj = new URL(urlStr);
          if (urlObj.hostname === targetHost) {
            const searchPart = urlObj.search ? urlObj.search.substring(1) : "";
            return `href="${buildProxyUrl(urlObj.pathname, searchPart)}"`;
          }
        } catch {
          // Invalid URL, keep as is
        }
        return match;
      } else if (urlStr.startsWith("//")) {
        // Protocol-relative URL
        try {
          const urlObj = new URL(`https:${urlStr}`);
          if (urlObj.hostname === targetHost) {
            const searchPart = urlObj.search ? urlObj.search.substring(1) : "";
            return `href="${buildProxyUrl(urlObj.pathname, searchPart)}"`;
          }
        } catch {
          // Invalid URL, keep as is
        }
        return match;
      } else if (urlStr.startsWith("#") || urlStr.startsWith("javascript:") || urlStr.startsWith("mailto:") || urlStr.startsWith("tel:")) {
        // Hash links, javascript:, mailto:, tel: - keep as is
        return match;
      } else {
        // Relative URL - resolve it properly
        let resolvedPath: string;
        if (urlStr.startsWith("/")) {
          // Absolute path relative to root
          resolvedPath = urlStr;
        } else if (urlStr.startsWith("components/") || urlStr.startsWith("images/") || urlStr.startsWith("videos/") || urlStr.startsWith("audio/")) {
          // Paths starting with known directories should be treated as absolute from root
          resolvedPath = "/" + urlStr;
        } else {
          // Relative path - resolve relative to current directory
          resolvedPath = currentDir + urlStr;
          // Normalize the path (remove ./ and ../)
          const parts = resolvedPath.split("/");
          const normalized: string[] = [];
          for (const part of parts) {
            if (part === "..") {
              normalized.pop();
            } else if (part !== "." && part !== "") {
              normalized.push(part);
            }
          }
          resolvedPath = "/" + normalized.join("/");
        }
        const [path, search] = resolvedPath.split("?");
        const normalizedPath = path === "/" ? "/" : path;
        return `href="${buildProxyUrl(normalizedPath, search)}"`;
      }
    }
  );

  // Rewrite relative URLs in src attributes
  processed = processed.replace(
    /src=["']([^"']+)["']/gi,
    (match, urlStr) => {
      if (urlStr.startsWith("http://") || urlStr.startsWith("https://")) {
        try {
          const urlObj = new URL(urlStr);
          if (urlObj.hostname === targetHost) {
            const searchPart = urlObj.search ? urlObj.search.substring(1) : "";
            return `src="${buildProxyUrl(urlObj.pathname, searchPart)}"`;
          }
        } catch {
          // Invalid URL, keep as is
        }
        return match;
      } else if (urlStr.startsWith("//")) {
        try {
          const urlObj = new URL(`https:${urlStr}`);
          if (urlObj.hostname === targetHost) {
            const searchPart = urlObj.search ? urlObj.search.substring(1) : "";
            return `src="${buildProxyUrl(urlObj.pathname, searchPart)}"`;
          }
        } catch {
          // Invalid URL, keep as is
        }
        return match;
      } else if (urlStr.startsWith("data:") || urlStr.startsWith("blob:")) {
        // Data URLs and blob URLs - keep as is
        return match;
      } else {
        // Relative URL - resolve it properly
        let resolvedPath: string;
        if (urlStr.startsWith("/")) {
          // Absolute path relative to root
          resolvedPath = urlStr;
        } else if (urlStr.startsWith("components/") || urlStr.startsWith("images/") || urlStr.startsWith("videos/") || urlStr.startsWith("audio/")) {
          // Paths starting with known directories should be treated as absolute from root
          resolvedPath = "/" + urlStr;
        } else {
          // Relative path - resolve relative to current directory
          resolvedPath = currentDir + urlStr;
          // Normalize the path (remove ./ and ../)
          const parts = resolvedPath.split("/");
          const normalized: string[] = [];
          for (const part of parts) {
            if (part === "..") {
              normalized.pop();
            } else if (part !== "." && part !== "") {
              normalized.push(part);
            }
          }
          resolvedPath = "/" + normalized.join("/");
        }
        const [path, search] = resolvedPath.split("?");
        const normalizedPath = path === "/" ? "/" : path;
        return `src="${buildProxyUrl(normalizedPath, search)}"`;
      }
    }
  );

  // Rewrite URLs in action attributes (forms)
  processed = processed.replace(
    /action=["']([^"']+)["']/gi,
    (match, urlStr) => {
      if (urlStr.startsWith("http://") || urlStr.startsWith("https://")) {
        try {
          const urlObj = new URL(urlStr);
          if (urlObj.hostname === targetHost) {
            const searchPart = urlObj.search ? urlObj.search.substring(1) : "";
            return `action="${buildProxyUrl(urlObj.pathname, searchPart)}"`;
          }
        } catch {
          // Invalid URL, keep as is
        }
        return match;
      } else if (urlStr.startsWith("//")) {
        try {
          const urlObj = new URL(`https:${urlStr}`);
          if (urlObj.hostname === targetHost) {
            const searchPart = urlObj.search ? urlObj.search.substring(1) : "";
            return `action="${buildProxyUrl(urlObj.pathname, searchPart)}"`;
          }
        } catch {
          // Invalid URL, keep as is
        }
        return match;
      } else {
        // Relative URL - resolve it properly
        let resolvedPath: string;
        if (urlStr.startsWith("/")) {
          resolvedPath = urlStr;
        } else if (urlStr.startsWith("components/") || urlStr.startsWith("images/") || urlStr.startsWith("videos/") || urlStr.startsWith("audio/")) {
          resolvedPath = "/" + urlStr;
        } else {
          resolvedPath = currentDir + urlStr;
          const parts = resolvedPath.split("/");
          const normalized: string[] = [];
          for (const part of parts) {
            if (part === "..") {
              normalized.pop();
            } else if (part !== "." && part !== "") {
              normalized.push(part);
            }
          }
          resolvedPath = "/" + normalized.join("/");
        }
        const [path, search] = resolvedPath.split("?");
        const normalizedPath = path === "/" ? "/" : path;
        return `action="${buildProxyUrl(normalizedPath, search)}"`;
      }
    }
  );

  // Rewrite URLs in CSS url() functions within style tags
  processed = processed.replace(
    /<style[^>]*>([\s\S]*?)<\/style>/gi,
    (match, cssContent) => {
      const rewrittenCss = rewriteCssUrls(cssContent, targetHost, proxyBaseUrl, baseTargetUrl);
      return match.replace(cssContent, rewrittenCss);
    }
  );

  return processed;
}

function injectNavigationInterceptor(
  html: string,
  targetHost: string,
  proxyBaseUrl: string,
  targetUrlParam: string
): string {
  // Escape strings for safe injection
  const escapeJs = (str: string) => {
    return str.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/'/g, "\\'").replace(/\n/g, "\\n").replace(/\r/g, "\\r");
  };
  
  const escapedProxyBaseUrl = escapeJs(proxyBaseUrl);
  const escapedTargetUrlParam = escapeJs(targetUrlParam);
  const escapedTargetHost = escapeJs(targetHost);
  
  const interceptorScript = `
    <script>
      (function() {
        const proxyBaseUrl = "${escapedProxyBaseUrl}";
        const targetUrlParam = "${escapedTargetUrlParam}";
        const targetHost = "${escapedTargetHost}";
        
        // Helper function to convert URL to proxy URL
        function convertToProxyUrl(url) {
          try {
            const urlObj = typeof url === 'string' ? new URL(url, window.location.href) : url;
            if (urlObj.hostname === targetHost || urlObj.hostname === window.location.hostname) {
              const pathPart = urlObj.pathname === "/" ? "" : urlObj.pathname;
              const searchPart = urlObj.search ? urlObj.search.substring(1) : "";
              return proxyBaseUrl + pathPart + targetUrlParam + (searchPart ? "&" + searchPart : "");
            }
            return typeof url === 'string' ? url : urlObj.href;
          } catch (e) {
            // Relative URL or invalid URL
            const urlStr = typeof url === 'string' ? url : url.href || '';
            const pathPart = urlStr.startsWith("/") ? urlStr.split("?")[0] : "/" + urlStr.split("?")[0];
            const searchPart = urlStr.includes("?") ? urlStr.split("?")[1] : "";
            return proxyBaseUrl + pathPart + targetUrlParam + (searchPart ? "&" + searchPart : "");
          }
        }
        
        // Intercept window.location.replace()
        const originalReplace = window.location.replace.bind(window.location);
        window.location.replace = function(url) {
          const proxyUrl = convertToProxyUrl(url);
          originalReplace(proxyUrl);
        };
        
        // Intercept window.location.assign()
        const originalAssign = window.location.assign.bind(window.location);
        window.location.assign = function(url) {
          const proxyUrl = convertToProxyUrl(url);
          originalAssign(proxyUrl);
        };
        
        // Intercept direct assignment to location.href using a proxy
        // Since we can't override window.location, we intercept href assignments
        // Try to intercept href setter, but handle gracefully if it's not configurable
        try {
          let locationHrefDescriptor = Object.getOwnPropertyDescriptor(window.location, 'href');
          if (locationHrefDescriptor && locationHrefDescriptor.set && locationHrefDescriptor.configurable) {
            const originalHrefSetter = locationHrefDescriptor.set;
            Object.defineProperty(window.location, 'href', {
              get: locationHrefDescriptor.get,
              set: function(url) {
                const proxyUrl = convertToProxyUrl(url);
                originalHrefSetter.call(window.location, proxyUrl);
              },
              configurable: true,
              enumerable: true
            });
          }
        } catch (e) {
          // If we can't intercept href setter, that's okay - replace() and assign() are intercepted
          console.warn('Could not intercept location.href setter:', e);
        }
      })();
    </script>
  `;
  
  // Inject script before closing </head> or before </body>
  if (html.includes("</head>")) {
    return html.replace("</head>", interceptorScript + "</head>");
  } else if (html.includes("</body>")) {
    return html.replace("</body>", interceptorScript + "</body>");
  } else {
    return interceptorScript + html;
  }
}

function rewriteCssUrls(
  css: string,
  targetHost: string,
  proxyBaseUrl: string,
  targetUrlParam: string
): string {
  return css.replace(
    /url\(["']?([^"')]+)["']?\)/gi,
    (match, urlStr) => {
      // Remove quotes if present
      const cleanUrl = urlStr.replace(/^["']|["']$/g, "");
      
      if (cleanUrl.startsWith("http://") || cleanUrl.startsWith("https://")) {
        try {
          const urlObj = new URL(cleanUrl);
          if (urlObj.hostname === targetHost) {
            const pathPart = urlObj.pathname === "/" ? "" : urlObj.pathname;
            const searchPart = urlObj.search ? `&${urlObj.search.substring(1)}` : "";
            return `url("${proxyBaseUrl}${pathPart}${targetUrlParam}${searchPart}")`;
          }
        } catch {
          // Invalid URL, keep as is
        }
        return match;
      } else if (cleanUrl.startsWith("//")) {
        try {
          const urlObj = new URL(`https:${cleanUrl}`);
          if (urlObj.hostname === targetHost) {
            const pathPart = urlObj.pathname === "/" ? "" : urlObj.pathname;
            const searchPart = urlObj.search ? `&${urlObj.search.substring(1)}` : "";
            return `url("${proxyBaseUrl}${pathPart}${targetUrlParam}${searchPart}")`;
          }
        } catch {
          // Invalid URL, keep as is
        }
        return match;
      } else if (cleanUrl.startsWith("data:") || cleanUrl.startsWith("blob:")) {
        // Data URLs and blob URLs - keep as is
        return match;
      } else {
        // Relative URL - rewrite to proxy
        const cleanUrlPath = cleanUrl.startsWith("/") ? cleanUrl : `/${cleanUrl}`;
        const [path, search] = cleanUrlPath.split("?");
        const pathPart = path === "/" ? "" : path;
        const searchPart = search ? `&${search}` : "";
        return `url("${proxyBaseUrl}${pathPart}${targetUrlParam}${searchPart}")`;
      }
    }
  );
}

function rewriteJsUrls(
  js: string,
  targetHost: string,
  proxyBaseUrl: string,
  targetUrlParam: string
): string {
  // This is a basic implementation - JavaScript URL rewriting is complex
  // For now, we'll handle common patterns like fetch() and XMLHttpRequest
  let processed = js;

  // Rewrite fetch() calls with relative URLs
  processed = processed.replace(
    /fetch\(["']([^"']+)["']\)/gi,
    (match, urlStr) => {
      if (urlStr.startsWith("http://") || urlStr.startsWith("https://")) {
        try {
          const urlObj = new URL(urlStr);
          if (urlObj.hostname === targetHost) {
            const pathPart = urlObj.pathname === "/" ? "" : urlObj.pathname;
            const searchPart = urlObj.search ? `&${urlObj.search.substring(1)}` : "";
            return `fetch("${proxyBaseUrl}${pathPart}${targetUrlParam}${searchPart}")`;
          }
        } catch {
          // Invalid URL, keep as is
        }
        return match;
      } else if (!urlStr.startsWith("//") && !urlStr.startsWith("data:") && !urlStr.startsWith("blob:")) {
        // Relative URL - rewrite to proxy
        const cleanUrl = urlStr.startsWith("/") ? urlStr : `/${urlStr}`;
        const [path, search] = cleanUrl.split("?");
        const pathPart = path === "/" ? "" : path;
        const searchPart = search ? `&${search}` : "";
        return `fetch("${proxyBaseUrl}${pathPart}${targetUrlParam}${searchPart}")`;
      }
      return match;
    }
  );

  return processed;
}

