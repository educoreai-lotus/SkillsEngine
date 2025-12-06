FROM node:18-alpine

WORKDIR /app

# Public API base URL needed at build time by Next.js

ENV NEXT_PUBLIC_API_BASE_URL=http://backend:3000 

# Install dependencies
COPY package.json package-lock.json ./
RUN npm install

# Copy the rest of the app
COPY . .

# Build the Next.js app
RUN npm run build

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

CMD ["npm", "run", "start"]