const {
  Ed25519KeyIdentity,
  Secp256k1KeyIdentity,
} = require("@dfinity/identity");

const getIdentityFromPem = async (pem) => {
  var raw;

  pem = pem
    .replace(/(-{5}.*-{5})/g, "")
    .replace("\n", "")
    // Sepk256k1 keys
    .replace("BgUrgQQACg==", "")
    .trim();

  raw = Buffer.from(pem, "base64")
    .toString("hex")
    // Sepk256k1 keys
    .replace("30740201010420", "")
    .replace("a00706052b8104000aa144034200", "")
    // ED25519 keys
    .replace("3053020101300506032b657004220420", "")
    .replace("a123032100", "");

  const key = new Uint8Array(Buffer.from(raw.substring(0, 64), "hex"));

  var identity;

  try {
    identity = Ed25519KeyIdentity.fromSecretKey(key);
  } catch {
    try {
      identity = Secp256k1KeyIdentity.fromSecretKey(key);
    } catch (e) {
      console.log(e, "(e) Invalid key");
      process.exit(1);
    }
  }

  return identity;
};

module.exports = {
  getIdentityFromPem,
};
