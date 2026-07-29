process.env.TS_NODE_PROJECT =
  process.env.TS_NODE_PROJECT || "tsconfig.uc-features.json";

module.exports = {
  default: {
    paths: ["features/atdd/**/*.feature"],
    require: ["features/atdd/steps/**/*.ts"],
    requireModule: ["ts-node/register"],
    format: ["progress-bar"],
  },
};
