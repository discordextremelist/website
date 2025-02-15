# syntax=docker/dockerfile:1.4
# NOTE: You should have made a settings.json file before running docker compose.
ARG NODE_VERSION="20.11.1-alpine3.19"
FROM node:${NODE_VERSION}
# Copy to-be-compiled files to container filesystem
COPY . /opt/del
# Set new working dir
WORKDIR /opt/del
# Run apt update & add needed packages
RUN apk update && \
    apk add git ca-certificates
# Enable pnpm
RUN corepack enable pnpm
# Install node modules
RUN CI=true pnpm i
# Compile new dist file
RUN npx tsc-transpile-only
# Compile library module so it is readable by src
RUN pnpm run lib-compile
# Remove non-dist files
RUN rm -rf src/ @types/ .env.production
# Start the process within the container
CMD ["pnpm", "start"]