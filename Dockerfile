# Stage 1: Build the React app
FROM node:18 AS react-builder

WORKDIR /app

# Copy package.json and package-lock.json (if available)
COPY emojiclient/package*.json ./emojiclient/

# Install dependencies
RUN cd emojiclient && npm install

# Copy the rest of the React app source
COPY emojiclient ./emojiclient

# Build the React app
RUN cd emojiclient && npm run build

# Stage 2: Build the Go server
FROM golang:1.20 AS go-builder

WORKDIR /app

# Copy the local package files to the container's workspace
COPY . .

# Copy the built React app from the previous stage
COPY --from=react-builder /app/emojiclient/dist ./emojiclient/dist

# Build the Go application
RUN go build -o main server.go

# Stage 3: Create the final image
FROM golang:1.20

WORKDIR /app

# Copy the built executable from the go-builder stage
COPY --from=go-builder /app/main .

# Copy the built React app
COPY --from=react-builder /app/emojiclient/dist ./emojiclient/dist

# Expose port 8888 to the outside world
EXPOSE 8888

# Command to run the executable
CMD ["./main"]
