
const ALLOWED_HOSTS = {
  dailymotion: [
    "dailymotion.com",
    "www.dailymotion.com",
    "geo.dailymotion.com",
    "dai.ly"
  ],
  youtube: [
    "youtube.com",
    "www.youtube.com",
    "m.youtube.com",
    "youtu.be",
    "youtube-nocookie.com",
    "www.youtube-nocookie.com"
  ],
  vimeo: [
    "vimeo.com",
    "www.vimeo.com",
    "player.vimeo.com"
  ]
};

function hostMatches(host, list) {
  return list.includes(host);
}

function resolveVideo(value) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error("Video URL is required");
  }

  if (value.length > 4096) {
    throw new Error("URL is too long");
  }

  let url;

  try {
    url = new URL(value.trim());
  } catch {
    throw new Error("Invalid URL");
  }

  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.port
  ) {
    throw new Error("Only valid HTTPS URLs are accepted");
  }

  const host = url.hostname.toLowerCase();

  // Dailymotion
  if (hostMatches(host, ALLOWED_HOSTS.dailymotion)) {
    let id = "";

    if (host === "dai.ly") {
      id = url.pathname.split("/").filter(Boolean)[0] || "";
    } else {
      id =
        url.pathname.match(
          /^\/(?:video\/|embed\/video\/)([a-zA-Z0-9_-]+)/
        )?.[1] || "";
    }

    if (!/^[a-zA-Z0-9_-]{3,30}$/.test(id)) {
      throw new Error("Invalid Dailymotion video ID");
    }

    return {
      success: true,
      platform: "dailymotion",
      type: "embed",
      id,
      embedUrl: `https://www.dailymotion.com/embed/video/${id}`
    };
  }

  // YouTube
  if (hostMatches(host, ALLOWED_HOSTS.youtube)) {
    let id = "";

    if (host === "youtu.be") {
      id = url.pathname.split("/").filter(Boolean)[0] || "";
    } else {
      id =
        url.searchParams.get("v") ||
        url.pathname.match(
          /^\/(?:embed|shorts|live)\/([a-zA-Z0-9_-]+)/
        )?.[1] || "";
    }

    if (!/^[a-zA-Z0-9_-]{11}$/.test(id)) {
      throw new Error("Invalid YouTube video ID");
    }

    return {
      success: true,
      platform: "youtube",
      type: "embed",
      id,
      embedUrl: `https://www.youtube-nocookie.com/embed/${id}`
    };
  }

  // Vimeo
  if (hostMatches(host, ALLOWED_HOSTS.vimeo)) {
    const id = url.pathname.match(/\/(\d+)(?:\/|$)/)?.[1];

    if (!id) {
      throw new Error("Invalid Vimeo video ID");
    }

    return {
      success: true,
      platform: "vimeo",
      type: "embed",
      id,
      embedUrl: `https://player.vimeo.com/video/${id}`
    };
  }

  // Direct MP4 / WebM / OGG / HLS
  const path = url.pathname.toLowerCase();

  const formats = {
    ".mp4": "video",
    ".webm": "video",
    ".ogg": "video",
    ".m3u8": "hls"
  };

  const extension = Object.keys(formats).find(ext =>
    path.endsWith(ext)
  );

  if (extension) {
    return {
      success: true,
      platform: "direct",
      type: formats[extension],
      format: extension.substring(1),
      videoUrl: url.href
    };
  }

  throw new Error(
    "Unsupported source. Use Dailymotion, YouTube, Vimeo, MP4, WebM or M3U8."
  );
}

module.exports = { resolveVideo };
