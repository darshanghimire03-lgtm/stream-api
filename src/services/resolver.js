
function extractYouTubeId(url) {
  const host = url.hostname.replace(/^www\./, "");

  if (host === "youtu.be") {
    return url.pathname.split("/").filter(Boolean)[0];
  }

  if (
    host === "youtube.com" ||
    host === "m.youtube.com" ||
    host === "youtube-nocookie.com"
  ) {
    if (url.pathname === "/watch") {
      return url.searchParams.get("v");
    }

    const match = url.pathname.match(/^\/(embed|shorts|live)\/([^/]+)/);
    return match ? match[2] : null;
  }

  return null;
}

function extractDailymotionId(url) {
  const host = url.hostname.replace(/^www\./, "");

  if (!["dailymotion.com", "dai.ly"].includes(host)) {
    return null;
  }

  if (host === "dai.ly") {
    return url.pathname.split("/").filter(Boolean)[0] || null;
  }

  const match = url.pathname.match(
    /^\/(?:video|embed\/video)\/([^_/?]+)/
  );

  return match ? match[1] : null;
}

function resolveVideo(input) {
  let url;

  try {
    url = new URL(input);
  } catch {
    throw new Error("Invalid video URL");
  }

  if (!["http:", "https:"].includes(url.protocol)) {
    throw new Error("Only HTTP and HTTPS URLs are supported");
  }

  if (
    !url.hostname ||
    url.username ||
    url.password ||
    url.hostname === "localhost" ||
    url.hostname.endsWith(".localhost") ||
    url.hostname.endsWith(".local") ||
    !url.hostname.includes(".")
  ) {
    throw new Error("Unsupported video URL");
  }

  const youtubeId = extractYouTubeId(url);

  if (youtubeId && /^[a-zA-Z0-9_-]{11}$/.test(youtubeId)) {
    return {
      provider: "youtube",
      type: "embed",
      id: youtubeId,
      embedUrl: `https://www.youtube-nocookie.com/embed/${youtubeId}`,
      originalUrl: url.href
    };
  }

  const dailymotionId = extractDailymotionId(url);

  if (dailymotionId && /^[a-zA-Z0-9]+$/.test(dailymotionId)) {
    return {
      provider: "dailymotion",
      type: "embed",
      id: dailymotionId,
      embedUrl: `https://www.dailymotion.com/embed/video/${dailymotionId}`,
      originalUrl: url.href
    };
  }

  const pathname = url.pathname.toLowerCase();

  if (pathname.endsWith(".mp4")) {
    return {
      provider: "direct",
      type: "mp4",
      streamUrl: url.href,
      originalUrl: url.href
    };
  }

  if (
    pathname.endsWith(".m3u8")
  ) {
    return {
      provider: "direct",
      type: "hls",
      streamUrl: url.href,
      originalUrl: url.href
    };
  }

  return {
    provider: "external",
    type: "embed",
    embedUrl: url.href,
    originalUrl: url.href,
    note: "Playback depends on whether the website permits iframe embedding."
  };
}

module.exports = { resolveVideo };
