# syntax=docker/dockerfile:1.4
# NOTE: You should have made a settings.json file before running docker compose.
# Node v17 is EOL, Node v18 is current
ARG NODE_VERSION="18.15.0-alpine3.16"
FROM node:${NODE_VERSION} as build
# Set new working dir
WORKDIR /opt/del
# Copy to-be-compiled files to container filesystem
COPY . /opt/del/
# Run apt update & add needed packages
RUN apk update && \
    apk add git ca-certificates
# Install node modules
RUN npm ci --production
# Compile new dist file
RUN npx tsc-transpile-only
# Remove non-dist files
RUN rm -rf src/ @types/ .env.production
# Start the process within the container
CMD ["npm", "start"]
