var DAI = artifacts.require('DAI.sol');
var CrosschainLoans = artifacts.require('CrosschainLoans.sol');
var CollateralLockV2 = artifacts.require('CollateralLockV2.sol');
var AggregatorTest = artifacts.require('AggregatorTest');

module.exports = function (deployer) {
    // deployment steps
    deployer.deploy(DAI);
    deployer.deploy(CrosschainLoans);
    // deployer.deploy(CollateralLockV2);
    // deployer.deploy(AggregatorTest);
};