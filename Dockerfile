
FROM node:22-bookworm-slim

RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    ffmpeg \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json ./

RUN npm install --omit=dev

COPY requirements.txt ./

RUN pip3 install --break-system-packages \
    --no-cache-dir -r requirements.txt

COPY src ./src

ENV NODE_ENV=production

EXPOSE 3000

CMD ["npm", "start"]
