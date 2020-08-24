# Discord Extreme List version 5.x.x

[![Compile](https://github.com/discordextremelist/website/workflows/Compile/badge.svg)](https://github.com/discordextremelist/website/actions?query=workflow%3ACompile)
[![Discord](https://img.shields.io/discord/568567800910839811?color=7289da&logo=discord&logoColor=white)](https://discord.gg/WeCer3J)
[![DeepScan grade](https://deepscan.io/api/teams/8370/projects/12889/branches/206397/badge/grade.svg)](https://deepscan.io/dashboard#view=project&tid=8370&pid=12889&bid=206397)
[![Snyk vulnerabilities](https://img.shields.io/snyk/vulnerabilities/github/discordextremelist/website?logo=snyk)](https://snyk.io/test/github/discordextremelist/website)
[![Code style](https://img.shields.io/badge/code%20style-prettier-ff69b4?logo=prettier&logoColor=white)](https://prettier.io)
[![Crowdin](https://badges.crowdin.net/delly/localized.svg)](https://translate.discordextremelist.xyz/project/delly)  

Licensing information viewable in the [LICENSE](https://github.com/discordextremelist/website/blob/master/LICENSE) file.

# Setup

## Requirements

### Node.js

DEL requires Node.js 14.

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

When you first start DEL, and every time you make a change to any of the `.ts` files, you will need to run the `npm run compile` command.

### Production

We recommend when running DEL in production you use the `npm run pm2` command, however you can still run DEL using the standard `npm run start` command.

### Development/Testing

We recommend you run DEL using the `npm run start` command.
