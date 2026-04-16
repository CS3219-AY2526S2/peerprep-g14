# FROM --platform=linux/amd64 golang:1.25-alpine AS builder
# FROM golang:1.25-alpine AS builder
FROM golang:1.26-alpine AS builder

WORKDIR /app

ENV GOPROXY=https://proxy.golang.org,direct

# Copy go mod files
COPY go.mod go.sum ./
RUN go mod download

# Copy the source code
COPY . .

# ENV GOPATH /app

# Build the application
# RUN CGO_ENABLED=0 GOOS=linux go build -o /question-service .
RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -o /question-service

# Use a lightweight alpine image for running
FROM --platform=linux/amd64 alpine:latest
# FROM alpine:latest

WORKDIR /

# Copy the pre-built binary
COPY --from=builder /question-service /question-service
RUN chmod +x /question-service 

EXPOSE 3002

# Run the executable
ENTRYPOINT ["/question-service"]
# CMD ["/question-service"]
