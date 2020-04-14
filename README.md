# Discord Extreme List version 5.x.x

Licensing information viewable in LICENSE.md

# Setup

## Requirements

### Node.JS Framework

You must ideally have Node.JS v13.x.x installed, other versions have not been tested and may cause instability.

### nodemon (Optional)

nodemon is optional and allows you to use the `npm run dev` command which is ideal in development, nodemon auto restarts on file save.

### PM2 (Optional)

PM2 is optional and allows you to use the `npm run pm2` command which is ideal if you wish to run DEL in production.

### MongoDB

A MongoDB instance is required - it must match the configuration in the `settings.json` file.

### Redis

Redis must be installed for authentication/sessions to work - it must match the configuration in the `settings.json` file.

## Setup

Install all of the dependencies by running `npm run installdeps`

## Running DEL

### Development

#### With nodemon (Reccomended)

Run the `npm run dev` command.

#### Without nodemon

Run the `npm run start` command.

### Production

#### With PM2

Run the `npm run pm2` command.

#### Without PM2

Run the `npm run start` command.