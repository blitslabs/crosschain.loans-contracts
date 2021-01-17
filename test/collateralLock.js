const truffleAssert = require('truffle-assertions')
const Web3 = require('web3')
const BigNumber = require('bignumber.js')
const { sha256 } = require('@liquality-dev/crypto')
const { assert } = require('chai')
const ethers = require('ethers')
const wallet = require('ethereumjs-wallet')
const helper = require('../utils/utils')
const CollateralLock = artifacts.require('./CollateralLock.sol')
const AggregatorTest = artifacts.require('./AggregatorTest.sol')
const HTTP_PROVIDER = 'http://localhost:7545'

let collateralLock, aggregatorTest
const SECONDS_IN_DAY = 86400

contract('CollateralLock', async () => {
    const mnemonic = 'nest gallery bubble wedding then earth spring health shallow prefer whale isolate'
    const ownerWallet = ethers.Wallet.fromMnemonic(mnemonic, "m/44'/60'/0'/0/0")
    const lenderWallet = ethers.Wallet.fromMnemonic(mnemonic, "m/44'/60'/0'/0/1")
    const lenderAutoWallet = ethers.Wallet.fromMnemonic(mnemonic, "m/44'/60'/0'/0/2")
    const borrowerWallet = ethers.Wallet.fromMnemonic(mnemonic, "m/44'/60'/0'/0/3")
    const owner2Wallet = ethers.Wallet.fromMnemonic(mnemonic, "m/44'/60'/0'/0/4")
    const aCoinLenderWallet = ethers.Wallet.fromMnemonic(mnemonic, "m/44'/60'/0'/0/5")

    // accounts
    const owner = ownerWallet.address
    const lender = lenderWallet.address
    const lenderAuto = lenderAutoWallet.address
    const borrower = borrowerWallet.address
    const owner_2 = owner2Wallet.address
    const aCoinLender = aCoinLenderWallet.address

    // private keys
    const lenderPrivateKey = lenderWallet.privateKey
    const lenderAutoPrivateKey = lenderAutoWallet.privateKey
    const borrowerPrivateKey = borrowerWallet.privateKey
    const aCoinLenderPrivateKey = aCoinLenderWallet.privateKey

    // prices
    const initialPrice = '541000'

    beforeEach(async () => {
        collateralLock = await CollateralLock.new({ from: owner })
        aggregatorTest = await AggregatorTest.new({ from: owner })
        await aggregatorTest.updateAnswer(initialPrice)
    })

    describe('Deployment', () => {
        it('should enable contract',async () => {
            const contractEnabled = await collateralLock.contractEnabled()
            assert.equal(contractEnabled, '1', 'Contract is not enabled')
        })

        it('owner should be authorized', async () => {
            const isAuthorized = await collateralLock.authorizedAccounts(owner)
            assert.equal(isAuthorized, 1, 'Owner is not authorized')
        })

        it('should emit AddAuthorization event', async () => {
            const events = await collateralLock.getPastEvents('AddAuthorization', {
                fromBlock: 0, toBlock: 'latest'
            })
            assert.equal(events[0].returnValues.account, owner, 'AddAuthorization event not emitted')
        })
    })

    describe('Administration', () => {
        it('should add authorization', async () => {
            await collateralLock.addAuthorization(owner_2)
            const owner2IsAuthorized = await collateralLock.authorizedAccounts(owner_2)
            const events = await collateralLock.getPastEvents('AddAuthorization', {
                fromBlock: 0, toBlock: 'latest'
            })
            assert.equal(owner2IsAuthorized, 1, 'Owner2 is not authorized')
            assert.equal(events[1].returnValues.account, owner_2, 'AddAuthorization event not emitted')
        })

        it('should fail to add authorization if not authorized', async () => {
            await truffleAssert.reverts(
                collateralLock.addAuthorization(owner_2, { from: owner_2 }),
                'CollateralLock/account-not-authorized',
                'User should\'t be able to authorize another account if it\'s not authorized'
            )            
        })

        it('should fail to add authorization if contract is not enabled', async () => {
            await collateralLock.disableContract()
            await truffleAssert.reverts(
                collateralLock.addAuthorization(owner_2, { from: owner }),
                'CollateralLock/contract-not-enabled',
                'Sender should\'t be able to authorize another account if the contract is not enabled'
            )
        })

        it('should disable contract', async () => {
            await collateralLock.disableContract({ from: owner })
            const contractEnabled = await collateralLock.contractEnabled()
            const events = await collateralLock.getPastEvents('DisableContract', {
                fromBlock: 0, toBlock: 'latest'
            })
            assert.equal(contractEnabled, 0, 'Contract is not disabled')
            assert.equal(events[0].event, 'DisableContract', 'DisableContract event not emitted')
        })

        it('should fail to disable contract if sender is not authorized', async () => {
            await truffleAssert.reverts(
                collateralLock.disableContract({ from: owner_2 }),
                'CollateralLock/account-not-authorized',
                'Sender should\'t be able to disable contract if not authorized'
            )
        })

        it('should enable contract', async () => {
            await collateralLock.disableContract({ from: owner })
            await collateralLock.enableContract({ from: owner })
            const contractEnabled = await collateralLock.contractEnabled()
            const events = await collateralLock.getPastEvents('EnableContract', {
                fromBlock: 0, toBlock: 'latest'
            })
            assert.equal(contractEnabled, 1, 'Contract not enabled')
            assert.equal(events[0].event, 'EnableContract', 'EnableContract event not emitted')
        })

        it('should fail to enable contract if sender is not authorized', async () => {
            await collateralLock.disableContract({ from: owner })
            await truffleAssert.reverts(
                collateralLock.enableContract({ from: owner_2 }),
                'CollateralLock/account-not-authorized',
                'Sender should\'t be able to enable contract if not authorized'
            )
        })
    })

    describe('Loan Parameters', () => {
        it('should modifyLoanParameters', async () => {
            const web3 = new Web3()
            const param1 = 'loanExpirationPeriod'
            const data1 = '1000'
            const param2 = 'seizureExpirationPeriod'
            const data2 = '1000'
            const param3 = 'collateralizationRatio'
            const data3 = '1000'
            const param4 = 'priceFeed'
            const data4 = aggregatorTest.address
            await collateralLock.modifyLoanParameters(web3.utils.fromAscii(param1), data1)
            await collateralLock.modifyLoanParameters(web3.utils.fromAscii(param2), data2)
            await collateralLock.modifyLoanParameters(web3.utils.fromAscii(param3), data3)
            await collateralLock.modifyLoanParameters(web3.utils.fromAscii(param4), data4)
            const loanExpirationPeriod = await collateralLock.loanExpirationPeriod()
            const seizureExpirationPeriod = await collateralLock.seizureExpirationPeriod()
            const collateralizationRatio = await collateralLock.collateralizationRatio()
            assert.equal(loanExpirationPeriod, data1, 'Invalid loan expiration period')
            assert.equal(seizureExpirationPeriod, data2, 'Invalid seizureExpirationPeriod')
            assert.equal(collateralizationRatio, data3, 'Invalid collateralizationRatio')
            const events = await collateralLock.getPastEvents('ModifyLoanParameters', {
                fromBlock: 0, toBlock: 'latest'
            })
            assert.equal(events[0].event, 'ModifyLoanParameters', 'ModifyLoanParameters event not emitted')
        })

        it('should fail to modifyLoanParameters if contract is disabled', async () => {
            const web3 = new Web3()
            const param1 = 'loanExpirationPeriod'
            const data1 = '1000'
            await collateralLock.disableContract()
            await truffleAssert.reverts(
                collateralLock.modifyLoanParameters(web3.utils.fromAscii(param1), data1),
                'CollateralLock/contract-not-enabled',
                'Shouldn\'t be able to modifyLoanParameters if contract is disabled'
            )
        })

        it('should fail to modifyLoanParameters if sender is not authorized', async () => {
            const param1 = 'loanExpirationPeriod'
            const data1 = '1000'
            await truffleAssert.reverts(
                collateralLock.modifyLoanParameters(
                    web3.utils.fromAscii(param1),
                    data1,
                    { from: owner_2 }
                ),
                'CollateralLock/account-not-authorized',
                'Shouldn\'t be able to modifyLoanParameters if sender is not authorized'
            )
        })

        it('should fail to modifyLoanParameters if data and parameter are invalid', async () => {
            const param1 = 'loanExpirationPeriod'
            const data1 = '1000'
            await truffleAssert.reverts(
                collateralLock.modifyLoanParameters(
                    web3.utils.fromAscii('invalidParam'),
                    data1,
                ),
                'CollateralLock/modify-unrecognized-param',
                'Shouldn\'t be able to modifyLoanParameters if parameter is invalid'
            )
            await truffleAssert.reverts(
                collateralLock.modifyLoanParameters(
                    web3.utils.fromAscii(param1),
                    '0',
                ),
                'CollateralLock/null-data',
                'Shouldn\'t be able to modifyLoanParameters if data is invalid'
            )
        })
    })


})