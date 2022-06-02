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
    console.warn("(!) COVER_ACCESS_TOKEN is not set");
}

// prefer the env variable, then dfx.json version, or run dfx --version.
const DFX_VERSION = process.env.DFX_VERSION || JSON.parse(fs.readFileSync(path.join(process.cwd(), "dfx.json"), "utf8")).version || execSync('dfx --version').toString().split(" ")[1].trim();
const DFX_PEM_PATH = path.join(process.env.HOME, ".config", "dfx");
const DFX_USER = JSON.parse(fs.readFileSync(path.join(DFX_PEM_PATH, "identity.json"), "utf8"))?.default;
let KEY_PATH = process.env.KEY_PATH;

if (!DFX_USER && !KEY_PATH) {
    console.error("(!) Could not find a default user in ~/.config/dfx/identity.json");
    KEY_PATH = readlineSync.question("Enter the path to your identity.pem: ");
} else {
    KEY_PATH = path.join(DFX_PEM_PATH, "identity", DFX_USER, "identity.pem")
}


console.log(`(i) Using dfx identity \`${DFX_USER}\` (${KEY_PATH})`);

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
        console.log("(e) Invalid key");
        process.exit(1);
    }
}


var COMMIT_HASH;
try {
    COMMIT_HASH = execSync('git rev-parse HEAD').toString().trim();
    console.log(`(i) Using commit hash \`${COMMIT_HASH}\` (HEAD)\n`);
} catch {
    COMMIT_HASH = readlineSync.question("(?) Commit hash: ");
}

var cover_config;
if (fs.existsSync(COVER_JSON_PATH)) {
    cover_config = JSON.parse(fs.readFileSync(COVER_JSON_PATH, "utf8"));
}

if (!cover_config || readlineSync.keyInYN("(?) Edit existing cover configuration?")) {
    cover_config = {
        "ownerId": identity.getPrincipal().toText(),
        "canisterId": readlineSync.question("(?) Canister ID ($<defaultInput>) ", { defaultInput: cover_config.canisterId }),
        "canisterName": readlineSync.question("(?) Canister Name ($<defaultInput>): ", { defaultInput: cover_config.canisterName }),
        "repoUrl": readlineSync.question("(?) Repo URL ($<defaultInput>): ", { defaultInput: cover_config.repoUrl || "psychedelic/dip721" }),
        "commitHash": readlineSync.question("(?) Commit hash ($<defaultInput>): ", { defaultInput: COMMIT_HASH }),
        "rustVersion": readlineSync.question("(?) Rust version ($<defaultInput>): ", { defaultInput: cover_config.rustVersion || execSync('rustc --version').toString().split(" ")[1].trim() }),
        "dfxVersion": readlineSync.question("(?) Dfinity version ($<defaultInput>): ", { defaultInput: cover_config.dfxVersion || DFX_VERSION }),
        "optimizeCount": Number(readlineSync.question("(?) Optimize count ($<defaultInput>): ", { defaultInput: (Number(cover_config.optimizeCount) >= 0) ? cover_config.optimizeCount : 1 })),
    };
} else {
    cover_config = {
        ...cover_config,
        "commitHash": COMMIT_HASH || readlineSync.question("(?) Commit hash: "),
    }
}

const timestamp = Date.now();
const signature = identity.sign(Buffer.from(timestamp.toString())).then(signature => {
    const request = {
        ...cover_config,
        "repoAccessToken": COVER_ACCESS_TOKEN || readlineSync.question("Repo access token: "),
        "publicKey": Buffer.from(identity.getPublicKey().toRaw()).toString('hex'),
        "signature": Buffer.from(signature).toString('hex'),
        timestamp
    };

    console.log("\nSubmitting cover build for", request.canisterName, "configuration:");
    console.group();
    console.log("\n", request, "\n");
    console.groupEnd();

    // fetch('https://h969vfa2pa.execute-api.us-east-1.amazonaws.com/production/build', {
    fetch('https://h969vfa2pa.execute-api.us-east-1.amazonaws.com/production/dryrun', {
        method: 'post',
        body: JSON.stringify(request),
        headers: { 'Content-Type': 'application/json' }
    }).then(res => {
        if (res.ok) {
            console.log("(i) Cover build submitted!");
        } else {
            console.log("(X) Cover build failed!");
            
            res.json().then(json => {
                console.log("Response: ", res.statusText, `(${res.status})\n`, json);
            });
        }
    }).catch(e => {
        console.log("(X) Cover build submission failed:", e);
    });
}).catch(err => {
    console.log(err);
    process.exit(1);
}).then(() => {
    console.log("(i) Saving cover configuration to", COVER_JSON_PATH);
    try {
        fs.writeFileSync(COVER_JSON_PATH, JSON.stringify(cover_config, null, 2));
    } catch (e) {
        console.log("(X) Failed to write cover configuration to", COVER_JSON_PATH, ":", e);
    }
});

