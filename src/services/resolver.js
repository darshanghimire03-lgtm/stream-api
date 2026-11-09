
function getVideoId(url) {
  const parsed = new URL(url);
  const host = parsed.hostname.toLowerCase();

  // Dailymotion
  if (
    host === "dailymotion.com" ||
    host.endsWith(".dailymotion.com")
  ) {
    const match = parsed.pathname.match(
      /\/(?:video|embed\/video)\/([a-zA-Z0-9]+)/
    );

    if (match) {
      return {
        type: "embed",
        platform: "dailymotion",
        id: match[1],
        embedUrl:
          `https://www.dailymotion.com/embed/video/${match[1]}`
      };
    }
  }

  // Dailymotion short links
  if (host === "dai.ly") {
    const id = parsed.pathname.split("/").filter(Boolean)[0];

    if (id) {
      return {
        type: "embed",
        platform: "dailymotion",
        id,
        embedUrl:
          `https://www.dailymotion.com/embed/video/${id}`
      };
    }
  }

  // YouTube
  if (
    host === "youtube.com" ||
    host === "www.youtube.com" ||
    host === "m.youtube.com" ||
    host === "youtube-nocookie.com" ||
    host === "www.youtube-nocookie.com"
  ) {
    let id =
      parsed.searchParams.get("v") ||
      parsed.pathname.match(
        /^\/(?:shorts|embed|live)\/([a-zA-Z0-9_-]+)/
      )?.[1];

    if (id) {
      return {
        type: "embed",
        platform: "youtube",
        id,
        embedUrl:
          `https://www.youtube-nocookie.com/embed/${id}`
      };
    }
  }

  // YouTube short links
  if (host === "youtu.be") {
    const id = parsed.pathname.split("/").filter(Boolean)[0];

    if (id) {
      return {
        type: "embed",
        platform: "youtube",
        id,
        embedUrl:
          `https://www.youtube-nocookie.com/embed/${id}`
      };
    }
  }

  // Vimeo
  if (
    host === "vimeo.com" ||
    host === "www.vimeo.com"
  ) {
    const id = parsed.pathname.match(/\/(\d+)/)?.[1];

    if (id) {
      return {
        type: "embed",
        platform: "vimeo",
        id,
        embedUrl:
          `https://player.vimeo.com/video/${id}`
      };
    }
  }

  // Direct video URLs
  const pathname = parsed.pathname.toLowerCase();

  if (pathname.endsWith(".mp4")) {
    return {
      type: "video",
      platform: "direct",
      format: "mp4",
      videoUrl: url
    };
  }

  if (
    pathname.endsWith(".m3u8") ||
    pathname.endsWith(".m3u")
  ) {
    return {
      type: "hls",
      platform: "direct",
      format: "hls",
      videoUrl: url
    };
  }

  throw new Error(
    "Unsupported video URL. Use Dailymotion, YouTube, Vimeo, MP4 or M3U8."
  );
}

function resolveVideo(input) {
  if (!input || typeof input !== "string") {
    throw new Error("Video URL is required");
  }

  let parsed;

  try {
    parsed = new URL(input.trim());
  } catch {
    throw new Error("Invalid video URL");
  }

  if (parsed.protocol !== "https:") {
    throw new Error("Only HTTPS video URLs are allowed");
  }

  if (parsed.username || parsed.password) {
    throw new Error("URLs containing credentials are not allowed");
  }

  return {
    success: true,
    originalUrl: parsed.href,
    ...getVideoId(parsed.href)
  };
}

module.exports = { resolveVideo };
