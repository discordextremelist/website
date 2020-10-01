# Discord Extreme List version 5.8.9 by WealthxPratham

[![Compile](https://github.com/discordextremelist/website/workflows/Compile/badge.svg)](https://github.com/discordextremelist/website/actions?query=workflow%3ACompile)
[![Discord](https://img.shields.io/discord/568567800910839811?color=7289da&logo=discord&logoColor=white)](https://discord.gg/WeCer3J)
[![DeepScan grade](https://deepscan.io/api/teams/8370/projects/12889/branches/206397/badge/grade.svg)](https://deepscan.io/dashboard#view=project&tid=8370&pid=12889&bid=206397)
[![Snyk vulnerabilities](https://img.shields.io/snyk/vulnerabilities/github/discordextremelist/website?logo=snyk)](https://snyk.io/test/github/discordextremelist/website)
[![Code style](https://img.shields.io/badge/code%20style-prettier-ff69b4?logo=prettier&logoColor=white)](https://prettier.io)
[![Crowdin](https://badges.crowdin.net/delly/localized.svg)](https://translate.discordextremelist.xyz/project/delly)  

Licensing information viewable in the [LICENSE](https://github.com/discordextremelist/website/blob/master/LICENSE) file.

We welcome contributions to DEL! If you need any help contributing, please talk to us in our Discord server.

Note that we do not support running public clones: you are allowed to do it if you follow the license, but we will not provide any support. The following instructions are only for users running DEL in development to contribute.

# Setup

## Requirements

### Node.js

DEL requires [Node.js](https://nodejs.org) 14+.

### MongoDB

A [MongoDB](https://mongodb.com) instance is required - it must match the configuration in the `settings.json` file.

### Redis

[Redis](https://redis.io) or [Memurai](https://memurai.com) must be installed and running - it must match the configuration in the `settings.json` file.

### NPM Packages
Install all of the dependencies by running `npm i`.

## Configuration

Rename `settings.example.json` to `settings.json` and fill it out appropriately, changing anything you need to change.

## Running DEL

When you first start DEL, and every time you make a change to any of the `.ts` files, you will need to run `npm run compile`.

Run `npm start` to start DEL.
