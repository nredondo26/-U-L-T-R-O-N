FROM oven/bun:latest AS builder
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile
COPY . .
RUN bun build src/index.ts --compile --outfile dist/ultron --target bun-linux-x64

FROM debian:bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates && rm -rf /var/lib/apt/lists/*
COPY --from=builder /app/dist/ultron /usr/local/bin/ultron
COPY --from=builder /app/src/server/public /app/public
EXPOSE 3456
ENV OPENCODE_WORKSPACE=/workspace
VOLUME ["/workspace", "/root/.jarvis"]
ENTRYPOINT ["ultron", "--web", "--port", "3456"]
