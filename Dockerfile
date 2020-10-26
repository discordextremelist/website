FROM node:14-alpine
WORKDIR /app
RUN apk update && apk add git ca-certificates
COPY . .
RUN mv settings.example.json settings.json
RUN npm ci --production
RUN npx tsc-transpile-only
RUN rm -rf src/ @types/ settings.json
CMD ["npm", "start"]
