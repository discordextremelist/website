# Discord Extreme List version 5.x.x

![Snyk Vulnerabilities for GitHub Repo](https://img.shields.io/snyk/vulnerabilities/github/discordextremelist/website)
![GitHub last commit](https://img.shields.io/github/last-commit/discordextremelist/website)
![GitHub commit activity](https://img.shields.io/github/commit-activity/w/discordextremelist/website)
![GitHub commits since latest release (by SemVer including pre-releases)](https://img.shields.io/github/commits-since/discordextremelist/website/v5.0.0-Alpha.6?include_prereleases)

Licensing information viewable in the LICENSE file

# Setup

## Requirements

### Node.JS Framework

**We recommend that you use Node.JS v12.x.x LTS.**

| Node Version        | Supported          |
| ------------------- | ------------------ |
| < v10               | 🔴 No Support      |
| v10 Maintenance LTS | 🟢 Full Support    |
| v12 Active LTS      | 🟢 Full Support    |
| v13 Previous (EOL)  | 🟡 Partial Support |     
| v14 Current         | 🟢 Full Support    |  

| Name                    | Definition                                                                                     |
| ----------------------- | ---------------------------------------------------------------------------------------------- |
| 🟢 Full Support         | We will provide version-specific security and bug patches.                                     |
| 🟡 Partial Support      | We will provide version-specific security pacthes.                                             |
| 🔴 No Support           | We will not provide any security or bug patches for this version, please use another version.  |     

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

When you first start DEL or you make changes to any files in DEL's src folder you will need to compile using the `npm run compile` command.

### Production

We reccomend when running DEL in production you use the `npm run pm2` command, however you can still run DEL using the standard `npm run start` command.

### Development/Testing

We reccomend you run DEL using the `npm run start` command.