
import asyncio
import ipaddress
import socket
import time
from urllib.parse import urljoin, urlsplit

import httpx
import yt_dlp
from bs4 import BeautifulSoup
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field


APP_VERSION = "5.0.0"
MAX_HTML_SIZE = 2 * 1024 * 1024
MAX_REDIRECTS = 5

app = FastAPI(
    title="Stream API",
    description="Website video inspection and extraction API",
    version=APP_VERSION
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"]
)

extract_semaphore = asyncio.Semaphore(2)

# Basic in-memory rate limit.
request_history = {}


class URLRequest(BaseModel):
    url: str = Field(min_length=8, max_length=4096)


def check_rate_limit(request: Request):
    client_ip = request.client.host if request.client else "unknown"
    now = time.time()

    history = [
        t for t in request_history.get(client_ip, [])
        if now - t < 60
    ]

    if len(history) >= 20:
        request_history[client_ip] = history
        return False

    history.append(now)
    request_history[client_ip] = history
    return True


@app.middleware("http")
async def limit_requests(request: Request, call_next):
    if request.url.path.startswith("/api/"):
        if not check_rate_limit(request):
            return JSONResponse(
                status_code=429,
                content={
                    "success": False,
                    "error": "Too many requests. Try again later."
                }
            )

    return await call_next(request)


def validate_url(value: str):
    if not isinstance(value, str) or len(value) > 4096:
        raise ValueError("Invalid URL")

    try:
        parts = urlsplit(value.strip())
    except Exception:
        raise ValueError("Invalid URL")

    if parts.scheme not in ("http", "https"):
        raise ValueError("Only HTTP and HTTPS URLs are supported")

    if not parts.hostname:
        raise ValueError("URL hostname is missing")

    if parts.username or parts.password:
        raise ValueError("URLs containing credentials are not allowed")

    try:
        port = parts.port
    except ValueError:
        raise ValueError("Invalid port")

    allowed_port = 443 if parts.scheme == "https" else 80

    if port is not None and port != allowed_port:
        raise ValueError("Only standard HTTP/HTTPS ports are allowed")

    host = parts.hostname.rstrip(".").lower()

    if host == "localhost" or host.endswith(
        (".localhost", ".local", ".internal")
    ):
        raise ValueError("Local hostnames are not allowed")

    try:
        addresses = socket.getaddrinfo(
            host,
            port or allowed_port,
            type=socket.SOCK_STREAM
        )
    except socket.gaierror:
        raise ValueError("Website hostname could not be resolved")

    if not addresses:
        raise ValueError("Website IP address not found")

    for address in addresses:
        ip = ipaddress.ip_address(address[4][0])

        if not ip.is_global:
            raise ValueError("Private or reserved IP addresses are blocked")

    return value.strip()


def safe_media_url(value, base_url):
    if not value:
        return None

    try:
        result = urljoin(base_url, value)
        parts = urlsplit(result)

        if parts.scheme not in ("http", "https"):
            return None

        if not parts.hostname:
            return None

        return result
    except Exception:
        return None


async def fetch_public_html(value: str):
    current_url = validate_url(value)

    headers = {
        "User-Agent": (
            "Mozilla/5.0 (compatible; StreamAPI/5.0; "
            "+https://example.com)"
        ),
        "Accept": "text/html,application/xhtml+xml"
    }

    async with httpx.AsyncClient(
        timeout=15,
        follow_redirects=False,
        trust_env=False
    ) as client:

        for _ in range(MAX_REDIRECTS + 1):
            current_url = validate_url(current_url)

            async with client.stream(
                "GET",
                current_url,
                headers=headers
            ) as response:

                if response.status_code in (301, 302, 303, 307, 308):
                    location = response.headers.get("location")

                    if not location:
                        raise ValueError("Website returned an invalid redirect")

                    current_url = urljoin(current_url, location)
                    continue

                response.raise_for_status()

                content_type = response.headers.get(
                    "content-type", ""
                ).lower()

                if "text/html" not in content_type:
                    raise ValueError(
                        "The URL did not return an HTML webpage"
                    )

                chunks = []
                total = 0

                async for chunk in response.aiter_bytes():
                    total += len(chunk)

                    if total > MAX_HTML_SIZE:
                        raise ValueError(
                            "Webpage source is larger than the allowed limit"
                        )

                    chunks.append(chunk)

                html = b"".join(chunks).decode(
                    response.encoding or "utf-8",
                    errors="replace"
                )

                return current_url, html

    raise ValueError("Too many website redirects")


def inspect_html(page_url: str, html: str):
    soup = BeautifulSoup(html, "html.parser")

    title = None

    if soup.title:
        title = soup.title.get_text(" ", strip=True)

    og_title = soup.find("meta", property="og:title")

    if og_title and og_title.get("content"):
        title = og_title["content"]

    description = None

    for attr in ("og:description", "description"):
        tag = soup.find("meta", attrs={"property": attr})

        if not tag:
            tag = soup.find("meta", attrs={"name": attr})

        if tag and tag.get("content"):
            description = tag["content"]
            break

    media_sources = set()
    embedded_players = set()

    for tag in soup.find_all(["video", "source", "iframe", "embed"]):
        src = (
            tag.get("src")
            or tag.get("data-src")
            or tag.get("data-lazy-src")
        )

        media_url = safe_media_url(src, page_url)

        if not media_url:
            continue

        if tag.name in ("iframe", "embed"):
            embedded_players.add(media_url)
        else:
            media_sources.add(media_url)

    for tag in soup.find_all("meta"):
        key = tag.get("property") or tag.get("name") or ""

        if key.lower() in (
            "og:video",
            "og:video:url",
            "og:video:secure_url"
        ):
            media_url = safe_media_url(
                tag.get("content"),
                page_url
            )

            if media_url:
                media_sources.add(media_url)

    for tag in soup.find_all("video"):
        for source in tag.find_all("source"):
            media_url = safe_media_url(
                source.get("src"),
                page_url
            )

            if media_url:
                media_sources.add(media_url)

    return {
        "success": True,
        "page": page_url,
        "title": title,
        "description": description,
        "mediaSources": list(media_sources),
        "embeddedPlayers": list(embedded_players),
        "sourceLength": len(html),
        "sourcePreview": html[:6000]
    }


def run_extractor(url: str):
    options = {
        "quiet": True,
        "no_warnings": True,
        "no_playlist": True,
        "skip_download": True,
        "socket_timeout": 20,
        "noplaylist": True,
        "ignoreerrors": False
    }

    with yt_dlp.YoutubeDL(options) as ydl:
        info = ydl.extract_info(url, download=False)

    if not info:
        raise ValueError("No video information was returned")

    formats = []

    for item in info.get("formats", []):
        media_url = item.get("url")

        if not media_url:
            continue

        formats.append({
            "format_id": item.get("format_id"),
            "format": item.get("format"),
            "ext": item.get("ext"),
            "resolution": item.get("resolution"),
            "width": item.get("width"),
            "height": item.get("height"),
            "fps": item.get("fps"),
            "videoCodec": item.get("vcodec"),
            "audioCodec": item.get("acodec"),
            "protocol": item.get("protocol"),
            "filesize": (
                item.get("filesize")
                or item.get("filesize_approx")
            ),
            "url": media_url
        })

    return {
        "success": True,
        "extractor": info.get("extractor"),
        "title": info.get("title"),
        "description": info.get("description"),
        "webpageUrl": info.get("webpage_url"),
        "thumbnail": info.get("thumbnail"),
        "duration": info.get("duration"),
        "uploader": info.get("uploader"),
        "formats": formats[:40],
        "formatCount": len(formats)
    }


@app.get("/")
async def root():
    return {
        "success": True,
        "name": "Stream API",
        "version": APP_VERSION,
        "status": "online",
        "endpoints": {
            "health": "/api/health",
            "inspect": "/api/v1/inspect",
            "resolve": "/api/v1/resolve"
        }
    }


@app.get("/api/health")
async def health():
    return {
        "success": True,
        "name": "Stream API",
        "version": APP_VERSION,
        "status": "online",
        "extractor": "yt-dlp"
    }


@app.get("/api/v1/inspect")
async def inspect_get(request: Request, url: str):
    try:
        page_url, html = await fetch_public_html(url)
        return inspect_html(page_url, html)

    except Exception as error:
        return JSONResponse(
            status_code=400,
            content={
                "success": False,
                "error": str(error)
            }
        )


@app.post("/api/v1/inspect")
async def inspect_post(request: Request, body: URLRequest):
    return await inspect_get(request, body.url)


@app.get("/api/v1/resolve")
async def resolve_get(request: Request, url: str):
    try:
        safe_url = validate_url(url)

        async with extract_semaphore:
            result = await asyncio.wait_for(
                asyncio.to_thread(run_extractor, safe_url),
                timeout=75
            )

        return result

    except asyncio.TimeoutError:
        return JSONResponse(
            status_code=504,
            content={
                "success": False,
                "error": "Video extraction timed out"
            }
        )

    except Exception as error:
        return JSONResponse(
            status_code=400,
            content={
                "success": False,
                "error": str(error)[:1000]
            }
        )


@app.post("/api/v1/resolve")
async def resolve_post(body: URLRequest):
    return await resolve_get(None, body.url)


@app.get("/api")
async def api_info():
    return {
        "name": "Stream API",
        "version": APP_VERSION,
        "documentation": "/docs",
        "endpoints": [
            "GET /api/health",
            "GET /api/v1/inspect?url=URL",
            "POST /api/v1/inspect",
            "GET /api/v1/resolve?url=URL",
            "POST /api/v1/resolve"
        ]
    }
