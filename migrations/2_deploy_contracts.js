var DAI = artifacts.require('DAI.sol');
var BlitsLoans = artifacts.require('BlitsLoans.sol');
var HarmonyLock = artifacts.require('HarmonyLock.sol');

module.exports = function (deployer) {
    // deployment steps
    deployer.deploy(DAI);
    deployer.deploy(BlitsLoans);
    deployer.deploy(HarmonyLock);
};