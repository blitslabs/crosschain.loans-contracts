const { toWei, padLeft, numberToHex } = web3.utils
var DAI = artifacts.require('DAI.sol');
var CrosschainLoans = artifacts.require('CrosschainLoans.sol')
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

    // deployer.deploy(CrosschainLoans);
    // deployer.deploy(CollateralLockV2);
    // deployer.deploy(AggregatorTest);

    // Deploy DAI
    await deployer.deploy(DAI)
    var dai = await DAI.deployed()
    
    // Deploy USDC
    await deployer.deploy(DAI)
    var usdc = await DAI.deployed()

    await deployer.deploy(Unitroller)
    var unitroller = await Unitroller.deployed()

    await deployer.deploy(Comptroller)
    var comptroller = await Comptroller.deployed()

    // Admin config
    await unitroller._setPendingImplementation(comptroller.address)
    await unitroller._acceptImplementation()
    await comptroller._setLiquidationIncentive(toWei('1.05', 'ether'))
    await comptroller._setMaxAssets(10)    

    // Interest Rate Model
    await deployer.deploy(DAIInterestRateModel, toWei('0.05', 'ether'), toWei('0.12', 'ether'))
    await deployer.deploy(USDCInterestRateModel, toWei('0', 'ether'), toWei('0.2', 'ether'))
    await deployer.deploy(ETHInterestRateModel, toWei('0', 'ether'), toWei('0.2', 'ether'))
    var daiInterestRateModel = await DAIInterestRateModel.deployed()
    var usdcInterestRateModel = await USDCInterestRateModel.deployed()
    var ethInterestRateModel = await ETHInterestRateModel.deployed()

    // cDAI
    await deployer.deploy(CErc20, dai.address, comptroller.address, daiInterestRateModel.address, toWei('0.2', 'gether'), 'Compound Dai', 'cDAI', '8')
    var cdai = await CErc20.deployed()

    // cUSDC
    var cusdc = await CErc20.new(usdc.address, comptroller.address, usdcInterestRateModel.address, toWei('0.2', 'finney'), 'Compound Usdc', 'cUSDC', '8')

    // cETH
    await deployer.deploy(CEther, comptroller.address, ethInterestRateModel.address, toWei('0.2', 'gether'), 'Compound Ether', 'cETH', '8')
    var ceth = await CEther.deployed()

    // Support Market
    await comptroller._supportMarket(cdai.address)

    // Oracles
    await deployer.deploy(MakerMedianizer)
    var makerMedianizer = await MakerMedianizer.deployed()
    await makerMedianizer.poke(padLeft(numberToHex(toWei('200', 'ether')), 64))
    
    await deployer.deploy(PriceOracle, accounts[0], dai.address, makerMedianizer.address, usdc.address, makerMedianizer.address)
    var priceOracle = await PriceOracle.deployed()

    await deployer.deploy(PriceOracleProxy, comptroller.address, priceOracle.address, ceth.address)
    var priceOracleProxy = await PriceOracleProxy.deployed()

    // Set Prices
    await priceOracle.setPrices([padLeft(numberToHex(1), 40)], [toWei('0.0049911026', 'ether')])
    await priceOracle.setPrices([padLeft(numberToHex(2), 40)], [toWei('0.0049911026', 'ether')])

    // Comptroller Config
    await comptroller._setPriceOracle(priceOracleProxy.address)
    await comptroller._setCollateralFactor(ceth.address, toWei('0.75', 'ether'))

    //
    await comptroller.enterMarkets([cdai.address, cusdc.address, ceth.address])

    await dai.approve(cdai.address, toWei('100', 'ether'))
    await cdai.mint(toWei('100', 'ether'))

    await usdc.approve(cusdc.address, toWei('100', 'mwei'))
    await cusdc.mint(toWei('100', 'mwei'))
};