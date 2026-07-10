FROM node:20-alpine

# Set timezone to IST so the backend clock evaluates late/early check-ins correctly
RUN apk add --no-cache tzdata
ENV TZ=Asia/Kolkata

WORKDIR /app

COPY package*.json ./
RUN npm install --production

COPY . .

EXPOSE 3000

CMD ["npm", "start"]
