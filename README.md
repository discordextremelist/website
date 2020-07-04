# Discord Extreme List version 5.x.x

Licensing information viewable in the LICENSE file

# Setup

## Requirements

### Node.JS Framework

**We recommend that you use the latest fully supported version of NodeJS.**

| Node Version        | Supported          |
| ------------------- | ------------------ |
| < v10               | 🔴 No Support      |
| v10 Maintenance LTS | 🟡 Partial Support |
| v11 End of Life     | 🟡 Partial Support |
| v12 Active LTS      | 🟢 Full Support    |   
| v13 Previous (EOL)  | 🟢 Full Support    |     
| v14 Current         | 🟢 Full Support    |  

| Name                    | Definition                                                                                                   |
| ----------------------- | ------------------------------------------------------------------------------------------------------------ |
| 🟢 Full Support         | This code has been tested and is currently actively supported on this version.                               |
| 🟡 Partial Support      | This code has been previously tested on this version, however it is no longer supported and may stop working |
| 🔴 No Support           | This code has not been tested on this version and may break at any time or outright not work.                |     

### nodemon (Optional)

nodemon is optional and allows you to use the `npm run dev` command which is ideal in development, nodemon auto restarts on file save.

### PM2 (Optional)

PM2 is optional and allows you to use the `npm run pm2` command which is ideal if you wish to run DEL in production.

### MongoDB

A MongoDB instance is required - it must match the configuration in the `settings.json` file.

### Redis

Redis must be installed for caching to work, the site will not function correctly without it - it must match the configuration in the `settings.json` file.

### NPM Packages
Install all of the dependencies by running `npm i` command.

## Configuration

1. Rename `settings.example.json` to `settings.json` and fill it out appropriately, changing anything you need to change.
2. (Optional) In addition to this you may wish to change some of the things in the `variables.ts` file located in `src/Util/Function`.

## Running DEL

### Compiling

#### First Start

When you first start DEL you will need to run the following command: `npm run compile && npm run editor-compile`

#### Making Changes

Every time you make a change to any of the `.ts` files you will need to run the `npm run compile` command to ensure everything is up to date.

### Production

We reccomend when running DEL in production you use the `npm run pm2` command, however you can still run DEL using the standard `npm run start` command.

### Development/Testing

We reccomend you run DEL using the `npm run start` command.
