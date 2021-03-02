const { artifacts } = require("hardhat");

const { toWei, padLeft, numberToHex } = web3.utils
var DAI = artifacts.require('DAI.sol');
var CrosschainLoans = artifacts.require('CrosschainLoans.sol')
var CrosschainLoansMoneyMarket = artifacts.require('CrosschainLoansMoneyMarket.sol')
var CollateralLockV2 = artifacts.require('CollateralLockV2.sol')
var AggregatorTest = artifacts.require('AggregatorTest')

var CErc20 = artifacts.require('./CErc20.sol')
var CEther = artifacts.require('./CEther.sol')
var Unitroller = artifacts.require('./Unitroller.sol')
var Comptroller = artifacts.require('./Comptroller.sol')
var PriceOracle = artifacts.require('./_PriceOracle.sol')
var PriceOracleProxy = artifacts.require('./PriceOracleProxy.sol')
var MakerMedianizer = artifacts.require('./_MakerMedianizer.sol')
var DAIInterestRateModel = artifacts.require('./DAIInterestRateModel.sol')
var USDCInterestRateModel = artifacts.require('./USDCInterestRateModel.sol')
var ETHInterestRateModel = artifacts.require('./ETHInterestRateModel.sol')

module.exports = async function (deployer, network, accounts) {
    // deployment steps
    deployer.deploy(CrosschainLoansMoneyMarket)
    // deployer.deploy(CrosschainLoans);
    // deployer.deploy(CollateralLockV2);
    // deployer.deploy(AggregatorTest);

    // Deploy DAI
    
};