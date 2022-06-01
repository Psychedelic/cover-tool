#!/usr/bin/node
const fs = require('fs');
const { Ed25519KeyIdentity, Secp256k1KeyIdentity } = require("@dfinity/identity");
const { execSync } = require('child_process');
const path = require('path');
const readlineSync = require('readline-sync');
const fetch = (...args) =>
import('node-fetch').then(({ default: fetch }) => fetch(...args));

const COVER_JSON_PATH = process.env.COVER_JSON_PATH || path.join(process.cwd(), "cover.json");
const COVER_ACCESS_TOKEN = process.env.COVER_ACCESS_TOKEN || null;
if (!COVER_ACCESS_TOKEN) {
    console.warn("/!\\ COVER_ACCESS_TOKEN is not set");
}

// prefer the env variable, then dfx.json version, or run dfx --version.
const DFX_VERSION = process.env.DFX_VERSION || JSON.parse(fs.readFileSync(path.join(process.cwd(), "dfx.json"), "utf8")).version || execSync('dfx --version').toString().split(" ")[1].trim();
const DFX_PEM_PATH = path.join(process.env.HOME, ".config", "dfx");
const DFX_USER = JSON.parse(fs.readFileSync(path.join(DFX_PEM_PATH, "identity.json"), "utf8"))?.default;
const KEY_PATH = process.env.KEY_PATH || path.join(DFX_PEM_PATH, "identity", DFX_USER, "identity.pem");

console.log("KEY_PATH: ", KEY_PATH);

let pem = fs.readFileSync(KEY_PATH).toString();

var raw;

if (pem.startsWith('-----BEGIN PUBLIC KEY-----')) {
    // ED25519 key
    pem = pem.replace('-----BEGIN PRIVATE KEY-----', '')
        .replace('-----END PRIVATE KEY-----', '')
        .replace('\n', '')
        .trim();

    raw = Buffer.from(pem, 'base64')
        .toString('hex')
        .replace('3053020101300506032b657004220420', '')
        .replace('a123032100', '');
} else {
    // Sepk256k1 key
    pem = pem.replace(`-----BEGIN EC PARAMETERS-----
BgUrgQQACg==
-----END EC PARAMETERS-----
-----BEGIN EC PRIVATE KEY-----`, '')
        .replace(`-----END EC PRIVATE KEY-----`, '')
        .replace('\n', '')
        .trim();

    raw = Buffer.from(pem, 'base64')
        .toString('hex')
        .replace('30740201010420', '')
        .replace('a00706052b8104000aa144034200', '')
}

const key = new Uint8Array(Buffer.from(raw.substring(0, 64), 'hex'));

var identity;

try {
    identity = Ed25519KeyIdentity.fromSecretKey(key);
} catch {
    try {
        identity = Secp256k1KeyIdentity.fromSecretKey(key);
    } catch {
        console.log("Invalid key");
        process.exit(1);
    }
}
try {
    fs.writeFileSync(COVER_JSON_PATH, JSON.stringify(cover_config, null, 2));
} catch (e) {
    console.log("Failed to write cover configuration to", COVER_JSON_PATH);
}
let cover_config = {};
if (fs.existsSync(COVER_JSON_PATH)) {
    cover_config = JSON.parse(fs.readFileSync(COVER_JSON_PATH, "utf8"));
} else {
    console.log("No cover configuration found, creating one");
    cover_config = {
        "canisterId": readlineSync.question("Canister ID: "),
        "canisterName": readlineSync.question("Canister Name: "),
        "repoUrl": readlineSync.question("Repo URL (github): "),
        "optimizeCount": readlineSync.question("Optimize count: "),
    }
}

const timestamp = Date.now();
const signature = identity.sign(Buffer.from(timestamp.toString())).then(signature => {
    cover_config = {
        "ownerId": identity.getPrincipal().toText(),
        "canisterId": cover_config.canisterId,
        "canisterName": cover_config.canisterName,
        "repoUrl": cover_config.repoUrl,
        "repoAccessToken": COVER_ACCESS_TOKEN,
        "commitHash": execSync('git rev-parse HEAD').toString().trim(),
        "rustVersion": cover_config.rustVersion || execSync('rustc --version').toString().split(" ")[1],
        "dfxVersion": cover_config.dfxVersion || DFX_VERSION,
        "optimizeCount": cover_config.optimizeCount || 1,
        "publicKey": Buffer.from(identity.getPublicKey().toRaw()).toString('hex'),
        "signature": Buffer.from(signature).toString('hex'),
        timestamp
    };

    console.log(cover_config);
    console.log("Submitting cover build for...");

    fetch('https://h969vfa2pa.execute-api.us-east-1.amazonaws.com/production/build', {
        method: 'post',
        body: JSON.stringify(cover_config),
        headers: { 'Content-Type': 'application/json' }
    }).then(res => {
        if (res.ok) {
            console.log("Cover build submitted");
        } else {
            console.log("Cover build submission failed");
        }
    });

    delete cover_config["repoAccessToken"];

    console.log("Saving cover configuration to", COVER_JSON_PATH);
    try {
        fs.writeFileSync(COVER_JSON_PATH, JSON.stringify(cover_config, null, 2));
    } catch (e) {
        console.log("Failed to write cover configuration to", COVER_JSON_PATH, ":", e);
    }
}).catch(err => {
    console.log(err);
    process.exit(1);
});

