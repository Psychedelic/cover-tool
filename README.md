# `cover-builder` - Cover build submission tool

Sign and submit a cover build request easily!

Communicates with the [cover-validator](https://github.com/Psychedelic/cover-validator) API for [cover](https://app.covercode.ooo/)

Reads the default (current) dfx identity, compatable with unencrypted pems.

Stores configuration in a `cover.json` file in the current working directory

## Installation

### NPM

`npm i -g cover-builder` or `yarn add -g cover-builder`

### Repo

1. clone repo
2. `cd coverage`
3. pull node packages
4. `npm install -g .`

## Usage

1. cd project root
2. build and deploy project with `@psychedelichq/cover` docker
3. run `cover-builder`
