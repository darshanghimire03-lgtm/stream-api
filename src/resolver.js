
const { execFile } = require("node:child_process");
const { promisify } = require("node:util");
const { validatePublicUrl } = require("./inspector");

const exec = promisify(execFile);

async function resolveVideo(value) {
  const url = await validatePublicUrl(value);

  let stdout;

  try {
    const result = await exec(
      "python3",
      [
        "-m",
        "yt_dlp",
        "--dump-single-json",
        "--no-warnings",
        "--no-playlist",
        "--skip-download",
        "--socket-timeout",
        "15",
        "--",
        url.href
      ],
      {
        timeout: 60000,
        maxBuffer: 8 * 1024 * 1024,
        windowsHide: true
      }
    );

    stdout = result.stdout;
  } catch (error) {
    const details = String(error.stderr || error.message)
      .slice(0, 1000);

    throw new Error("Extraction failed: " + details);
  }

  let info;

  try {
    info = JSON.parse(stdout);
  } catch {
    throw new Error("Extractor returned invalid information");
  }

  const formats = (info.formats || [])
    .filter(format => format.url)
    .map(format => ({
      id: format.format_id,
      format: format.format,
      ext: format.ext,
      resolution: format.resolution,
      width: format.width,
      height: format.height,
      fps: format.fps,
      videoCodec: format.vcodec,
      audioCodec: format.acodec,
      protocol: format.protocol,
      filesize: format.filesize || format.filesize_approx,
      url: format.url
    }))
    .slice(0, 40);

  return {
    success: true,
    extractor: info.extractor,
    title: info.title,
    description: info.description,
    webpageUrl: info.webpage_url,
    thumbnail: info.thumbnail,
    duration: info.duration,
    uploader: info.uploader,
    formats,
    formatCount: formats.length
  };
}

module.exports = { resolveVideo };
