const fs = require("fs");
const path = require("path");
const GitUrlParse = require("git-url-parse");
const { execSync } = require("child_process");
const fetch = (...args) =>
  import("node-fetch").then(({ default: fetch }) => fetch(...args));

const getDefaults = (canisterName) => {
  const commitHash = execSync("git rev-parse HEAD")?.toString().trim();

  // get git repo user and name
  const git = GitUrlParse(
    execSync("git remote get-url origin")?.toString().trim()
  );
  const repoUrl = `${git.owner}/${git.name}`;

  const canisterId =
    process.env.CANISTER_ID ||
    execSync(`dfx canister --network ic id ${canisterName}`).toString().trim();
  const rustVersion =
    process.env.RUST_VERSION ||
    execSync("rustc --version").toString().split(" ")[1].trim();
  const optimizeCount = 1;
  const dfxVersion =
    process.env.DFX_VERSION ||
    JSON.parse(fs.readFileSync(path.join(process.cwd(), "dfx.json"), "utf8"))
      .dfx ||
    execSync("dfx --version").toString().split(" ")[1].trim();

  return {
    canisterId,
    canisterName,
    repoUrl,
    commitHash,
    rustVersion,
    dfxVersion,
    optimizeCount,
  };
};

const publishToCover = async (
  identity,
  canisterName,
  cover_config,
  repoAccessToken
) => {
  const timestamp = Date.now();
  identity
    .sign(Buffer.from(timestamp.toString()))
    .then((signature) => {
      cover_config = {
        ownerId: identity.getPrincipal().toText(),
        canisterName,
        publicKey: Buffer.from(identity.getPublicKey().toRaw()).toString("hex"),
        signature: Buffer.from(signature).toString("hex"),
        timestamp,
        ...cover_config,
      };

      console.log(
        "\nSubmitting cover build for",
        cover_config.canisterName,
        "configuration:"
      );
      console.group();
      console.log("\n", { ...cover_config, repoAccessToken: "-snip-" }, "\n");
      console.groupEnd();

      //   fetch(
      //     "https://h969vfa2pa.execute-api.us-east-1.amazonaws.com/production/build",
      //     {
      //       method: "post",
      //       body: JSON.stringify({
      //         repoAccessToken,
      //         ...cover_config,
      //       }),
      //       headers: { "Content-Type": "application/json" },
      //     }
      //   )
      //     .then((res) => {
      //       if (res.ok) {
      //         console.log("(i) Cover build submitted!");
      //       } else {
      //         console.log("(X) Cover build failed!");

      //         res.json().then((json) => {
      //           console.log(
      //             "Response: ",
      //             res.statusText,
      //             `(${res.status})\n`,
      //             json
      //           );
      //         });
      //       }
      //     })
      //     .catch((e) => {
      //       console.log("(X) Cover build submission failed:", e);
      //     });
    })
    .catch((err) => {
      console.log(err);
      process.exit(1);
    });
};

module.exports = {
  getDefaults,
  publishToCover,
};
