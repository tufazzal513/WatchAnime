# Dockerfile for MoveX Pure-Go Backend (BotKeep Cloud Deployment)
FROM golang:1.23-alpine AS builder

# Install build dependencies
RUN apk add --no-cache git ca-certificates

WORKDIR /app

# Copy go mod and sum files
COPY backend/go.mod backend/go.sum* ./
RUN go mod download || true

# Copy full backend source
COPY backend/ .

# Build production pure-Go binary (CGO free)
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -o /app/movex ./cmd/movex

# Final Lightweight Runtime Image
FROM alpine:3.20

RUN apk add --no-cache ca-certificates tzdata

WORKDIR /app

# Copy compiled binary from builder
COPY --from=builder /app/movex /app/movex

# Create persistent data and backups directory
RUN mkdir -p /app/data /app/data/backups

ENV PORT=3000
ENV ROLE=main
ENV DATA_DIR=/app/data

EXPOSE 3000

# Run MoveX server
ENTRYPOINT ["/app/movex", "serve"]
