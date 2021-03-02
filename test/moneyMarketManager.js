const { assert, expect } = require('chai')
const { ethers } = require('hardhat')
const BigNumber = require('bignumber.js')
const { toWei } = web3.utils

let owner, lender
let dai, cdai, cbusd, crosschainLoans

describe('MoneyMarketManager', async () => {

    beforeEach(async () => {
        [owner, lender] = await ethers.getSigners()

        // Deploy Example DAI
        const DAI = await ethers.getContractFactory('DAI')
        dai = await DAI.deploy()

        // Deploy Example cDAI
        cdai = await DAI.deploy()

        // Deply Example cBUSD
        cbusd = await DAI.deploy()

        // Deploay CrosschainLoansMoneyMarket
        const CrosschainLoansMoneyMarket = await ethers.getContractFactory('CrosschainLoansMoneyMarket')
        crosschainLoans = await CrosschainLoansMoneyMarket.deploy()
    })

    it('should add money market', async () => {
        await crosschainLoans.addMoneyMarket(dai.address, cdai.address)
        const moneyMarket = await crosschainLoans.moneyMarkets(dai.address)
        assert.equal(moneyMarket.isEnabled, true, 'Invalid money market state')
        assert.equal(moneyMarket.market, cdai.address, 'Invalid money market address')
    })

    it('should fail to add a money market if account is not authorized', async () => {
        await expect(crosschainLoans.connect(lender).addMoneyMarket(dai.address, cdai.address)).to.be.revertedWith('CrosschainLoans/account-not-authorized')
    })

    it('should fail to add a money market if the contract is paused', async () => {
        await crosschainLoans.disableContract()
        await expect(crosschainLoans.connect(owner).addMoneyMarket(dai.address, cdai.address)).to.be.revertedWith('CrosschainLoans/contract-not-enabled')
    })

    it('should toggle money market status', async () => {
        await crosschainLoans.toggleMoneyMarket(dai.address, false)
        let moneyMarket = await crosschainLoans.moneyMarkets(dai.address)
        assert.equal(moneyMarket.isEnabled, false, 'Invalid money market state')
        await crosschainLoans.toggleMoneyMarket(dai.address, true)
        moneyMarket = await crosschainLoans.moneyMarkets(dai.address)
        assert.equal(moneyMarket.isEnabled, true, 'Invalid money market state')
    })

    it('should fail to toggle a money market if account is not authorized', async () => {
        await expect(crosschainLoans.connect(lender).toggleMoneyMarket(dai.address, false)).to.be.revertedWith('CrosschainLoans/account-not-authorized')
    })

    it('should fail to add a money market if the contract is paused', async () => {
        await crosschainLoans.disableContract()
        await expect(crosschainLoans.connect(owner).toggleMoneyMarket(dai.address, false)).to.be.revertedWith('CrosschainLoans/contract-not-enabled')
    })

    it('should modify money market', async () => {
        await crosschainLoans.modifyMoneyMarket(dai.address, cbusd.address)  
        let moneyMarket = await crosschainLoans.moneyMarkets(dai.address)     
        assert.equal(moneyMarket.market, cbusd.address, 'Invalid money market address')
    })

    it('should fail to modify money market if account is not authorized', async () => {
        await expect(crosschainLoans.connect(lender).modifyMoneyMarket(dai.address, cbusd.address)).to.be.revertedWith('CrosschainLoans/account-not-authorized')
    })

    it('should fail modify money market if the contract is paused', async () => {
        await crosschainLoans.disableContract()
        await expect(crosschainLoans.connect(owner).modifyMoneyMarket(dai.address, cbusd.address)).to.be.revertedWith('CrosschainLoans/contract-not-enabled')
    })
})