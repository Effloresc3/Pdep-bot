FROM node:latest AS build-stage

WORKDIR /app

COPY package.json package-lock.json ./

RUN npm ci

COPY . .

RUN npm run build 

FROM node:latest AS final-stage

WORKDIR /app

COPY --from=build-stage /app/dist ./dist
COPY --from=build-stage /app/package.json ./
COPY --from=build-stage /app/package-lock.json ./

RUN npm ci --omit=dev

EXPOSE 3000 

CMD ["npm", "run", "start:prod"]
