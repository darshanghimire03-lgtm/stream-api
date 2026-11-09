
const dns = require("node:dns/promises");
const ipaddr = require("ipaddr.js");

async function validatePublicUrl(value) {
  if (typeof value !== "string" || value.length > 4096) {
    throw new Error("Invalid URL");
  }

  let url;

  try {
    url = new URL(value);
  } catch {
    throw new Error("Invalid URL format");
  }

  if (!["http:", "https:"].includes(url.protocol)) {
    throw new Error("Only HTTP and HTTPS are supported");
  }

  if (
    url.username ||
    url.password ||
    ![80, 443].includes(
      url.port ? Number(url.port) : url.protocol === "https:" ? 443 : 80
    )
  ) {
    throw new Error("Invalid URL credentials or port");
  }

  const hostname = url.hostname.toLowerCase();

  if (
    hostname === "localhost" ||
    hostname.endsWith(".localhost") ||
    hostname.endsWith(".local")
  ) {
    throw new Error("Local addresses are not allowed");
  }

  let addresses;

  try {
    addresses = await dns.lookup(hostname, { all: true });
  } catch {
    throw new Error("Website DNS lookup failed");
  }

  if (!addresses.length) {
    throw new Error("Website address not found");
  }

  for (const item of addresses) {
    let address;

    try {
      address = ipaddr.process(item.address);
    } catch {
      throw new Error("Invalid website IP address");
    }

    if (address.range() !== "unicast") {
      throw new Error("Private or reserved IP addresses are blocked");
    }
  }

  return url;
}

function extractAttributes(tag) {
  const result = {};
  const regex = /([a-zA-Z_:][-a-zA-Z0-9_:]*)\s*=\s*["']([^"']*)["']/g;

  let match;

  while ((match = regex.exec(tag)) !== null) {
    result[match[1].toLowerCase()] = match[2];
  }

  return result;
}

function safeResolve(value, base) {
  try {
    const url = new URL(value, base);

    if (!["http:", "https:"].includes(url.protocol)) {
      return null;
    }

    return url.href;
  } catch {
    return null;
  }
}

async function inspectWebsite(value) {
  const url = await validatePublicUrl(value);

  const response = await fetch(url.href, {
    redirect: "manual",
    signal: AbortSignal.timeout(12000),
    headers: {
      "User-Agent": "Mozilla/5.0 StreamAPI/4.0",
      "Accept": "text/html,application/xhtml+xml"
    }
  });

  if (response.status >= 300 && response.status < 400) {
    throw new Error(
      "Website redirected. Submit its final public URL directly."
    );
  }

  if (!response.ok) {
    throw new Error(`Website returned HTTP ${response.status}`);
  }

  const contentType = response.headers.get("content-type") || "";

  if (!contentType.includes("text/html")) {
    throw new Error("URL did not return an HTML webpage");
  }

  const html = (await response.text()).slice(0, 2_000_000);

  const media = new Set();
  const embeds = new Set();

  const tags = html.match(/<(?:video|source|iframe|embed)\b[^>]*>/gi) || [];

  for (const tag of tags) {
    const attrs = extractAttributes(tag);

    const src = attrs.src || attrs["data-src"];

    if (!src) continue;

    const resolved = safeResolve(src, url.href);

    if (!resolved) continue;

    if (/^<(?:iframe|embed)\b/i.test(tag)) {
      embeds.add(resolved);
    } else {
      media.add(resolved);
    }
  }

  const metaTags = html.match(/<meta\b[^>]*>/gi) || [];

  let ogVideo = null;
  let title = null;
  let description = null;

  for (const tag of metaTags) {
    const attrs = extractAttributes(tag);
    const key = attrs.property || attrs.name;

    if (
      key === "og:video" ||
      key === "og:video:url" ||
      key === "og:video:secure_url"
    ) {
      const result = safeResolve(attrs.content || "", url.href);
      if (result) ogVideo = result;
    }

    if (key === "og:title") {
      title = attrs.content || title;
    }

    if (key === "og:description" || key === "description") {
      description = attrs.content || description;
    }
  }

  if (ogVideo) media.add(ogVideo);

  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);

  if (!title && titleMatch) {
    title = titleMatch[1].replace(/<[^>]*>/g, "").trim();
  }

  return {
    success: true,
    page: url.href,
    title,
    description,
    mediaSources: [...media],
    embeddedPlayers: [...embeds],
    sourcePreview: html.slice(0, 6000),
    sourceLength: html.length
  };
}

module.exports = {
  inspectWebsite,
  validatePublicUrl
};
