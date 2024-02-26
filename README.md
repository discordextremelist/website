<p align="center">
  <img src="https://raw.githubusercontent.com/discordextremelist/website/main/assets/Public/img/logo-128px.png" />
</p>

# Discord Extreme List  5

[![Compile](https://github.com/discordextremelist/website/workflows/Compile/badge.svg)](https://github.com/discordextremelist/website/actions?query=workflow%3ACompile)
[![Discord](https://img.shields.io/discord/568567800910839811?color=5865f2&logo=discord&logoColor=white)](https://discord.gg/WeCer3J)
[![Code style](https://img.shields.io/badge/code%20style-prettier-ff69b4?logo=prettier&logoColor=white)](https://prettier.io)
[![Crowdin](https://badges.crowdin.net/delly/localized.svg)](https://translate.discordextremelist.xyz/project/delly)
[![DeepScan grade](https://deepscan.io/api/teams/8370/projects/12889/branches/206397/badge/grade.svg)](https://deepscan.io/dashboard#view=project&tid=8370&pid=12889&bid=206397)

Licensing information viewable in the [LICENSE](https://github.com/discordextremelist/website/blob/main/LICENSE) file.

We welcome contributions to DEL! If you need any help contributing, please talk to us in our Discord server.

Note that we do not support running public clones of the project: you are allowed to do it if you follow the license, but we will not provide any support and it goes against the intent of this project. We are an open source project to provide transparency to our community and allow developers to contribute as they wish to improve the project. The following instructions are only intended for users running DEL in development to contribute.

# Setup

## Requirements

### Node.js

DEL requires [Node.js](https://nodejs.org) v17.9.0+.

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
