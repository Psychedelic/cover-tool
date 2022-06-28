#!/usr/bin/node
const fs = require("fs");
const path = require("path");
const readlineSync = require("readline-sync");
const { getIdentityFromPem } = require("./pem");
const { publishToCover, getDefaults } = require("./lib");

console.log("test");

const DFX_PEM_PATH = path.join(process.env.HOME, ".config", "dfx");
const DFX_USER = JSON.parse(
  fs.readFileSync(path.join(DFX_PEM_PATH, "identity.json"), "utf8")
)?.default;
let KEY_PATH = process.env.KEY_PATH;

if (!DFX_USER && !KEY_PATH) {
  console.error(
    "(!) Could not find a default user in ~/.config/dfx/identity.json"
  );
  KEY_PATH = readlineSync.question("Enter the path to your identity.pem: ");
} else {
  KEY_PATH = path.join(DFX_PEM_PATH, "identity", DFX_USER, "identity.pem");
}

console.log(`(i) Using dfx identity \`${DFX_USER}\` (${KEY_PATH})`);
let pem = fs.readFileSync(KEY_PATH).toString();
let identity = getIdentityFromPem(pem)
  .then((identity) => {
    let cover_config = {};

    const COVER_JSON_PATH =
      process.env.COVER_JSON_PATH || path.join(process.cwd(), "cover.json");

    if (fs.existsSync(COVER_JSON_PATH)) {
      cover_config = JSON.parse(fs.readFileSync(COVER_JSON_PATH, "utf8"));
    }

    console.log("Previously verified canisters: ", Object.keys(cover_config));

    const canisterName = readlineSync.question(
      "Canister name (from dfx.json): "
    );

    const defaults = getDefaults(canisterName);

    if (
      !cover_config[canisterName] ||
      readlineSync.keyInYN("(?) Edit existing cover configuration?")
    ) {
      cover_config[canisterName] = {
        canisterId: readlineSync.question(
          "(?) Canister ID ($<defaultInput>) ",
          {
            defaultInput:
              cover_config[canisterName]?.canisterId || defaults.canisterId,
          }
        ),
        repoUrl: readlineSync.question("(?) Repo URL ($<defaultInput>): ", {
          defaultInput: cover_config[canisterName]?.repoUrl || defaults.repoUrl,
        }),
        commitHash: readlineSync.question(
          "(?) Commit hash ($<defaultInput>): ",
          {
            defaultInput: defaults.commitHash,
          }
        ),
        rustVersion: readlineSync.question(
          "(?) Rust version ($<defaultInput>): ",
          {
            defaultInput:
              cover_config[canisterName]?.rustVersion || defaults.rustVersion,
          }
        ),
        dfxVersion: readlineSync.question(
          "(?) Dfinity version ($<defaultInput>): ",
          {
            defaultInput:
              cover_config[canisterName]?.dfxVersion || defaults.dfxVersion,
          }
        ),
        optimizeCount: Number(
          readlineSync.question("(?) Optimize count ($<defaultInput>): ", {
            defaultInput:
              cover_config[canisterName]?.optimizeCount ||
              defaults.optimizeCount,
          })
        ),
      };
    } else {
      cover_config[canisterName] = {
        ...cover_config[canisterName],
        commitHash: defaults.commitHash,
      };
    }

    console.log(cover_config[canisterName]);

    const repoAccessToken = process.env.COVER_ACCESS_TOKEN || null;
    if (!repoAccessToken) {
      console.warn("(!) COVER_ACCESS_TOKEN is not set");
      //   process.exit(1);
    }

    publishToCover(
      identity,
      canisterName,
      cover_config[canisterName],
      repoAccessToken
    );

    console.log("(i) Saving cover configuration to", COVER_JSON_PATH);
    try {
      fs.writeFileSync(COVER_JSON_PATH, JSON.stringify(cover_config, null, 2));
    } catch (e) {
      console.log(
        "(X) Failed to write cover configuration to",
        COVER_JSON_PATH,
        ":",
        e
      );
    }
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
