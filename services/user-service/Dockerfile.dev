FROM node:22-alpine

# Create app directory
WORKDIR /usr/src/app

# Install app dependencies
# A wildcard is used to ensure both package.json AND package-lock.json are copied
COPY package*.json ./

RUN npm install

# Bundle app source
COPY . .

# Generate Prisma Client for the alpine linux environment
RUN npx prisma generate

# Expose port
EXPOSE 3001

# Start the application using tsx locally
CMD [ "npm", "run", "dev" ]
