FROM golang:1.26-alpine AS builder

WORKDIR /app

ENV GOPROXY=https://proxy.golang.org,direct

# Copy go mod files
COPY go.mod go.sum ./
RUN go mod download

# Copy the source code
COPY . .

# Build the application
RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -o /code-execution-service

# Use a lightweight alpine image for running
FROM alpine:latest

WORKDIR /

# Copy the pre-built binary
COPY --from=builder /code-execution-service /code-execution-service
RUN chmod +x /code-execution-service

EXPOSE 3006

ENTRYPOINT ["/code-execution-service"]
