# Discord Extreme List version 5.x.x

Licensing information viewable in LICENSE.md

# Setup

## Requirements

### Node.JS Framework

You must have Node.JS v13.x.x installed, other versions have not been tested and may cause instability.

### Python 3

Python 3 is required for the DEL bot to function as it is built using python.

### nodemon (Optional)

nodemon is optional and allows you to use the `npm run dev` command which is ideal in development, nodemon auto restarts on file save [**THIS WILL ONLY AFFECT THE WEBSITE**].

### PM2 (Optional)

PM2 is optional and allows you to use the `npm run pm2` command which is ideal if you wish to run DEL in production.

### RethinkDB

A rethinkdb instance is required - the database name must match the name configured in the settings.json file and the following tables MUST be created.

1. users
2. bots
3. servers
4. applications

### Redis

Redis must be installed for authentication/sessions to work.

## Setup

Install all of the dependencies by running `npm run installdeps`

## Running DEL

### Development

#### With nodemon (Reccomended)

Run the `npm run dev` command.
The API will be ran using node and the bot will be ran using the python3 command.

#### Without nodemon

Run the `npm run start` command.

### Production

#### With PM2

Run the `npm run pm2` command.

#### Without PM2

Run the `npm run start` command.