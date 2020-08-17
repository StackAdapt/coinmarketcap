# CoinMarketCap

This repository contains code designed to simulate various [CoinMarketCap](https://coinmarketcap.com) API endpoints for testing purposes. All data returned is randomly generated and should not be used in production environments. The application itself is built on top Node.js using the [Fastify](https://www.fastify.io) web framework and is accessible through StackAdapt servers for live testing. Please see below for a list of supported APIs as well as instructions for setting up the project.

## API

The following APIs are currently supported:

* [/coinmarketcap/map](https://github.com/stackadapt/coinmarketcap/wiki/Map)
* [/coinmarketcap/quotes](https://github.com/stackadapt/coinmarketcap/wiki/Quotes)

## Development

This is a standard Node application using [NPM](https://npmjs.org) for installing packages. There are scripts for starting the application with [nodemon](https://www.npmjs.com/package/nodemon) and also for linting the entire application with [eslint](https://www.npmjs.com/package/eslint).

```bash
# Install all the required packages
npm install

# Start the application with nodemon
npm run start

# Execute eslint on the source code
npm run lint
```
