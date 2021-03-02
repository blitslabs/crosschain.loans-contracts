const { assert, expect } = require('chai')
const { ethers } = require('hardhat')
const BigNumber = require('bignumber.js')
const { sha256 } = require('@liquality-dev/crypto')
// const Web = require('web3')
// const Web3 = require('web3')
// const web3 = new Web3()
const { toWei, padLeft, numberToHex } = web3.utils

let dai, usdc, daiInterestRateModel, usdcInterestRateModel, ethInterestRateModel, unitroller, comptroller
let cdai, cusdc, ceth, priceOracle, priceOracleProxy, makerMedianizer
let owner, lender, borrower, aCoinLender, bCoinBorrower
let crosschainLoans

describe('END2END', async () => {

    const initialBalance = new BigNumber(100e18).toString()

    // Interest Rate Model
    const baseRatePerYear = '50000000000000000'
    const multiplierPerYear = '1200000000000000000'

    beforeEach(async () => {
        // Get Accounts
        [owner, lender, borrower, aCoinLender, bCoinBorrower] = await ethers.getSigners()

        // Deploy Maker Medianizer
        const MakerMedianizer = await ethers.getContractFactory('_MakerMedianizer')
        makerMedianizer = await MakerMedianizer.deploy()
        await makerMedianizer.poke(padLeft(numberToHex(toWei('200', 'ether')), 64))

        // Deploy Example DAI
        const DAI = await ethers.getContractFactory('DAI')
        dai = await DAI.deploy()

        // Deploy Example USDC
        usdc = await DAI.deploy()

        // Transfer DAI to lender
        await dai.transfer(lender.address, initialBalance)

        // Deploy DAIInterestRateModel
        const DAIInterestRateModel = await ethers.getContractFactory('DAIInterestRateModel')
        daiInterestRateModel = await DAIInterestRateModel.deploy(toWei('0.05', 'ether'), toWei('0.12', 'ether'))

        // Deploy USDCInterestRateModel
        const USDCInterestRateModel = await ethers.getContractFactory('USDCInterestRateModel')
        usdcInterestRateModel = await USDCInterestRateModel.deploy(toWei('0', 'ether'), toWei('0.2', 'ether'))

        // Deploy ETHInterestRateModel
        const ETHInterestRateModel = await ethers.getContractFactory('ETHInterestRateModel')
        ethInterestRateModel = await ETHInterestRateModel.deploy(toWei('0', 'ether'), toWei('0.2', 'ether'))

        // Deploy Unitroller
        const Unitroller = await ethers.getContractFactory('Unitroller')
        unitroller = await Unitroller.deploy()

        // Deploy Comptroller
        const Comptroller = await ethers.getContractFactory('Comptroller')
        comptroller = await Comptroller.deploy()

        // Initial Comptroller configuration
        await unitroller._setPendingImplementation(comptroller.address)
        await unitroller._acceptImplementation()
        await comptroller._setLiquidationIncentive(toWei('1.05', 'ether'))
        await comptroller._setMaxAssets(10)

        // Deploy cdai
        const CErc20 = await ethers.getContractFactory('CErc20')
        cdai = await CErc20.deploy(
            dai.address,
            comptroller.address,
            daiInterestRateModel.address,
            toWei('1', 'ether'),
            'Compound DAI',
            'cDAI',
            '8'
        )

        // Deploy cusdc        
        cusdc = await CErc20.deploy(
            usdc.address,
            comptroller.address,
            usdcInterestRateModel.address,
            toWei('1', 'ether'),
            'Compound Usdc',
            'cUSDC',
            '8'
        )

        // Deploy CEth
        const CEther = await ethers.getContractFactory('CEther')
        ceth = await CEther.deploy(
            comptroller.address,
            ethInterestRateModel.address,
            toWei('1', 'ether'),
            'Compound Ether',
            'cETH',
            '8'
        )

        // Support cdai
        await comptroller._supportMarket(cdai.address)
        await comptroller._supportMarket(cusdc.address)
        await comptroller._supportMarket(ceth.address)

        // Deploy Price Oracle
        const PriceOracle = await ethers.getContractFactory('_PriceOracle')
        priceOracle = await PriceOracle.deploy(owner.address, dai.address, makerMedianizer.address, usdc.address, makerMedianizer.address)

        // Deploy PriceOracleProxy
        const PriceOracleProxy = await ethers.getContractFactory('PriceOracleProxy')
        priceOracleProxy = await PriceOracleProxy.deploy(comptroller.address, priceOracle.address, ceth.address)

        // Set PriceOracle prices
        await priceOracle.setPrices([padLeft(numberToHex(1), 40)], [toWei('0.0049911026', 'ether')])
        await priceOracle.setPrices([padLeft(numberToHex(2), 40)], [toWei('0.0049911026', 'ether')])

        // Comptroller set price oracle
        await comptroller._setPriceOracle(priceOracleProxy.address)
        await comptroller._setCollateralFactor(ceth.address, toWei('0.75', 'ether'))

        // Enter markets
        await comptroller.connect(lender).enterMarkets([cdai.address, cusdc.address, ceth.address])

        // Mint cTokens
        await dai.connect(owner).approve(cdai.address, toWei('1000', 'ether'))
        await cdai.connect(owner).mint(toWei('1000', 'ether'))

    })

    it('should mint cTokens', async () => {
        // Lender => Approve allowance
        await dai.connect(lender).approve(cdai.address, toWei('100', 'ether'))
        await cdai.connect(lender).mint(toWei('100', 'ether'))

        // Owner => Approve allowance
        await dai.connect(owner).approve(cdai.address, toWei('100', 'ether'))
        await cdai.connect(owner).mint(toWei('100', 'ether'))

        // Get cDAI balance
        const balance = await cdai.balanceOf(lender.address)
        // console.log(balance.toString())
        // assert.equal(balance.toString(), toWei('100', 'ether').toString(), 'Invalid balance')
    })

    describe('CrosschainLoans', async () => {

        beforeEach(async () => {
            // Deploy Crosschain Loans
            const CrosschainLoansMoneyMarket = await ethers.getContractFactory('CrosschainLoansMoneyMarket')
            crosschainLoans = await CrosschainLoansMoneyMarket.deploy()

            const maxLoanAmount = toWei('1000', 'ether')
            const minLoanAmount = toWei('10', 'ether')
            const baseRatePerYear = toWei('0.05', 'ether')
            const multiplierPerYear = toWei('1', 'ether')
            const referralFees = toWei('0.05', 'ether')

            // Add AssetType to CrosschainLoans
            await crosschainLoans.connect(owner).addAssetType(
                dai.address,
                maxLoanAmount,
                minLoanAmount,
                baseRatePerYear,
                multiplierPerYear,
                referralFees
            )

            // Add Money Market
            await crosschainLoans.connect(owner).addMoneyMarket(
                dai.address,
                cdai.address
            )
        })

        it('should have set money market', async () => {
            const moneyMarket = await crosschainLoans.moneyMarkets(dai.address)
            assert.equal(moneyMarket.market, cdai.address, 'Invalid money market')
        })

        it('should create a loan and withdraw principal', async () => {
     
            // Approve allowance
            await dai.connect(lender).approve(crosschainLoans.address, toWei('1000', 'ether'))
            const allowance = await dai.connect(lender).allowance(lender.address, crosschainLoans.address)

            // Lender secretB1 / secretHashB1
            const lenderLoansCount = await crosschainLoans.userLoansCount(lender.address)

            const secretB1 = sha256(lender.signMessage(`SecretB1. Nonce: ${lenderLoansCount}`))
            const secretHashB1 = `0x${sha256(secretB1)}`

            // Lender secret / secretHash
            const borrowerLoansCount = await crosschainLoans.userLoansCount(borrower.address)
            const secretA1 = sha256(borrower.signMessage(`SecretA1. Nonce: ${borrowerLoansCount}`))
            const secretHashA1 = `0x${sha256(secretA1)}`

            const principal = toWei('100', 'ether')
            // console.log(await crosschainLoans.methods)

            // Create Loan
            await crosschainLoans.connect(lender).createLoan(
                secretHashB1,
                principal,
                dai.address,
                aCoinLender.address,
                // borrower.address
            )

            // Fetch loan
            const loan = await crosschainLoans.fetchLoan(1)
            assert.equal(loan.actors[1], lender.address, 'Invalid loan')

            // Check crosschainLoans balance
            const crosschainLoansBalance = await dai.balanceOf(crosschainLoans.address)
            assert.equal(crosschainLoansBalance.toString(), 0, 'Invalid crosschainLoans balance')

            // Check cdai balance
            const cdaiBalance = await cdai.balanceOf(crosschainLoans.address)
            assert.equal(cdaiBalance.toString(), toWei('100', 'ether'), 'Invalid cdai balance')

            // Assign Borrower and Approve
            await crosschainLoans.connect(lender).setBorrowerAndApprove(
                '1',
                borrower.address,
                secretHashA1
            )

            // Withdraw principal
            await crosschainLoans.connect(borrower).withdraw(1, `0x${secretA1}`)
            const borrowerBalance = await dai.balanceOf(borrower.address)
            assert.equal(borrowerBalance.toString(), toWei('100', 'ether'), 'Invalid borrower balance')

            const lenderBalance = await dai.balanceOf(lender.address)
            console.log(lenderBalance.toString())

            // CrosschainLoans <=> cDAI allowance
            const allowance_1 = await dai.allowance(crosschainLoans.address, cdai.address)
            console.log(allowance_1.toString())
        })
    })
})