
# Stream API

A video playback API for Android applications and websites.

## Features

- MP4 playback
- HLS M3U8 support
- YouTube embeds
- Dailymotion embeds
- External iframe embeds
- REST API
- Browser testing player
- Render deployment

## Installation

Clone the repository:

```bash
git clone https://github.com/YOUR_USERNAME/stream-api.git
```

Enter the project:

```bash
cd stream-api
```

Install dependencies:

```bash
npm install
```

Start the server:

```bash
npm start
```

Open:

http://localhost:3000

## API

### Health

GET /api/health

### Resolve video

GET /api/video?url=VIDEO_URL

Example:

```text
/api/video?url=https://www.dailymotion.com/video/x36gl5
```

### Player

GET /player

## Deployment

Deploy this repository using Render.

Build command:

npm install

Start command:

npm start

Health check:

/api/health

## Important

This API identifies supported URLs and generates
authorized playback/embed information.

It does not bypass DRM, authentication,
or website playback restrictions.

## License

MIT
