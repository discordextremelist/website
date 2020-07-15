FROM node:14-alpine
WORKDIR /app
COPY . .
RUN npm i
RUN npm run compile
RUN npm run editor-compile
RUN rm -rf src/ @types/
CMD ["npm", "start"]