var DAI = artifacts.require('DAI.sol');
var CrosschainLoans = artifacts.require('CrosschainLoans.sol');
var CollateralLock = artifacts.require('CollateralLock.sol');
var AggregatorTest = artifacts.require('AggregatorTest');

module.exports = function (deployer) {
    // deployment steps
    deployer.deploy(DAI);
    deployer.deploy(CrosschainLoans);
    deployer.deploy(CollateralLock);
    deployer.deploy(AggregatorTest)
};