FROM node:14-alpine
WORKDIR /app
RUN apk update
COPY . .
RUN mv settings.example.json settings.json
RUN npm i --production
RUN npm run compile
RUN rm -rf src/ @types/ settings.json
CMD ["npm", "start"]
