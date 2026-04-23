const TescoExpiryTracker = artifacts.require("TescoExpiryTracker");

module.exports = function(deployer) {
  deployer.deploy(TescoExpiryTracker);
};
