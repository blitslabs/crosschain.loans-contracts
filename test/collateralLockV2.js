const truffleAssert = require('truffle-assertions')
const Web3 = require('web3')
const BigNumber = require('bignumber.js')
const { sha256 } = require('@liquality-dev/crypto')
const { assert } = require('chai')
const ethers = require('ethers')
const wallet = require('ethereumjs-wallet')
const fromExponential = require('from-exponential')
const helper = require('../utils/utils')
const CrosschainLoans = artifacts.require('./CrosschainLoans.sol')
const CollateralLock = artifacts.require('./CollateralLockV2.sol')
const AggregatorTest = artifacts.require('./AggregatorTest.sol')
const HTTP_PROVIDER = 'http://localhost:7545'

let collateralLock, aggregatorTest, crosschainLoans
const SECONDS_IN_DAY = 86400

contract('CollateralLockV2', async () => {
    const mnemonic = 'nest gallery bubble wedding then earth spring health shallow prefer whale isolate'
    const ownerWallet = ethers.Wallet.fromMnemonic(mnemonic, "m/44'/60'/0'/0/0")
    const lenderWallet = ethers.Wallet.fromMnemonic(mnemonic, "m/44'/60'/0'/0/1")
    const lenderAutoWallet = ethers.Wallet.fromMnemonic(mnemonic, "m/44'/60'/0'/0/2")
    const borrowerWallet = ethers.Wallet.fromMnemonic(mnemonic, "m/44'/60'/0'/0/3")
    const owner2Wallet = ethers.Wallet.fromMnemonic(mnemonic, "m/44'/60'/0'/0/4")
    const aCoinLenderWallet = ethers.Wallet.fromMnemonic(mnemonic, "m/44'/60'/0'/0/5")
    const bCoinBorrowerWallet = ethers.Wallet.fromMnemonic(mnemonic, "m/44'/60'/0'/0/6")

    // accounts
    const owner = ownerWallet.address
    const lender = lenderWallet.address
    const lenderAuto = lenderAutoWallet.address
    const borrower = borrowerWallet.address
    const owner_2 = owner2Wallet.address
    const aCoinLender = aCoinLenderWallet.address
    const bCoinBorrower = bCoinBorrowerWallet.address

    // private keys
    const lenderPrivateKey = lenderWallet.privateKey
    const lenderAutoPrivateKey = lenderAutoWallet.privateKey
    const borrowerPrivateKey = borrowerWallet.privateKey
    const aCoinLenderPrivateKey = aCoinLenderWallet.privateKey
    const bCoinBorrowerPrivateKey = bCoinBorrowerWallet.privateKey

    // Globals
    const loanExpirationPeriod = 2851200 // 33 days
    const seizureExpirationPeriod = 3110400 // 36 days
    const collateralizationRatio = 150e18
    const initialPrice = '541000'

    const web3 = new Web3(HTTP_PROVIDER)
    const bCoinLoanId = '1'
    const bCoin = web3.utils.fromAscii('ethereum')

    beforeEach(async () => {
        crosschainLoans = await CrosschainLoans.new({ from: owner })
        collateralLock = await CollateralLock.new({ from: owner })
        aggregatorTest = await AggregatorTest.new({ from: owner })
        await collateralLock.modifyLoanParameters(web3.utils.fromAscii('priceFeed'), aggregatorTest.address)
        await aggregatorTest.updateAnswer(initialPrice, { from: owner })
        // await aggregatorTest.updateAnswer('0', { from: owner })
    })

    describe('Deployment', () => {
        it('should enable contract', async () => {
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
            const param1 = 'loanExpirationPeriod'
            const data1 = '1000'
            const param2 = 'collateralizationRatio'
            const data2 = '1000'
            const param3 = 'priceFeed'
            const data3 = aggregatorTest.address
            await collateralLock.modifyLoanParameters(web3.utils.fromAscii(param1), data1)
            await collateralLock.modifyLoanParameters(web3.utils.fromAscii(param2), data2)
            await collateralLock.modifyLoanParameters(web3.utils.fromAscii(param3), data3)
            const loanExpirationPeriod = await collateralLock.loanExpirationPeriod()
            const collateralizationRatio = await collateralLock.collateralizationRatio()
            assert.equal(loanExpirationPeriod, data1, 'Invalid loan expiration period')
            assert.equal(collateralizationRatio, data2, 'Invalid collateralizationRatio')
            const events = await collateralLock.getPastEvents('ModifyLoanParameters', {
                fromBlock: 0, toBlock: 'latest'
            })
            assert.equal(events[0].event, 'ModifyLoanParameters', 'ModifyLoanParameters event not emitted')
        })

        it('should fail to modifyLoanParameters if contract is disabled', async () => {
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

    describe('Lock Collateral', () => {
        const emptyAddress = '0x0000000000000000000000000000000000000000'
        const emptyBytes = '0x0000000000000000000000000000000000000000000000000000000000000000'

        let snapshot, snapshotId

        beforeEach(async () => {
            snapshot = await helper.takeSnapshot()
            snapshotId = snapshot['result']
        })

        afterEach(async () => {
            await helper.revertToSnapShot(snapshotId)
        })

        it('should lock collateral', async () => {

            // Borrower secret / secretHash
            let borrowerLoansCount = await crosschainLoans.userLoansCount(borrower)
            let secretA1 = sha256(web3.eth.accounts.sign(`SecretA1. Nonce ${borrowerLoansCount}`, borrowerPrivateKey))
            let secretHashA1 = `0x${sha256(secretA1)}`

            // Lender secret / secretHash
            let lenderLoansCount = await crosschainLoans.userLoansCount(lender)
            let secretB1 = sha256(web3.eth.accounts.sign(`SecretB1. Nonce: ${lenderLoansCount}`, lenderPrivateKey))
            let secretHashB1 = `0x${sha256(secretB1)}`

            // Lock Collateral Details
            const collateral = '9000000000000000000'
            const lockPrice = BigNumber('541000').multipliedBy(1e10).toString()
            const baseCollateral = BigNumber(collateral).multipliedBy(100e18).dividedBy(collateralizationRatio)
            const collateralValue = parseFloat(baseCollateral.multipliedBy(lockPrice))

            // Update Aggregator's Price
            await aggregatorTest.updateAnswer(lockPrice, { from: owner })

            const tx = await collateralLock.lockCollateral(
                lender,
                secretHashA1,
                secretHashB1,
                bCoinBorrower,
                bCoinLoanId,
                bCoin,
                { from: borrower, value: collateral }
            )

            const currentTimestamp = (await web3.eth.getBlock(tx.receipt.blockNumber))['timestamp']
            const loanExpiration = parseInt(currentTimestamp) + loanExpirationPeriod

            const loan = await collateralLock.fetchLoan(1)
            assert.equal(loan.actors[0], borrower, 'Invalid borrower')
            assert.equal(loan.actors[1], lender, 'Invalid lender')
            assert.equal(loan.secretHashes[0], secretHashA1, 'Invalid setHashA1')
            assert.equal(loan.secretHashes[1], secretHashB1, 'Invalid secretHashB1')
            assert.equal(loan.secrets[0], emptyBytes, 'Invalid secretA1')
            assert.equal(loan.secrets[1], emptyBytes, 'Invalid secretB1')
            assert.equal(loan.expirations[0], loanExpiration, 'Invalid loanExpiration')
            assert.equal(loan.expirations[1], currentTimestamp, 'Invalid createdAt')
            assert.equal(loan.details[0].toString(), collateral, 'Invalid collateral')
            assert.equal(loan.details[1].toString(), collateralValue, 'Invalid collateral value')
            assert.equal(loan.details[2].toString(), lockPrice, 'Invalid lockPrice')
            assert.equal(loan.details[3].toString(), lockPrice, 'Invalid liquidationPrice')
            assert.equal(loan.state, '0', 'Invalid loan state')
        })

        it('should fail to lock collateral is amount is invalid', async () => {
            // Borrower secret / secretHash
            let borrowerLoansCount = await crosschainLoans.userLoansCount(borrower)
            let secretA1 = sha256(web3.eth.accounts.sign(`SecretA1. Nonce ${borrowerLoansCount}`, borrowerPrivateKey))
            let secretHashA1 = `0x${sha256(secretA1)}`

            // Lender secret / secretHash
            let lenderLoansCount = await crosschainLoans.userLoansCount(lender)
            let secretB1 = sha256(web3.eth.accounts.sign(`SecretB1. Nonce: ${lenderLoansCount}`, lenderPrivateKey))
            let secretHashB1 = `0x${sha256(secretB1)}`

            // Lock Collateral Details
            const collateral = '0'

            await truffleAssert.reverts(
                collateralLock.lockCollateral(
                    lender,
                    secretHashA1,
                    secretHashB1,
                    bCoinBorrower,
                    bCoinLoanId,
                    bCoin,
                    { from: borrower, value: collateral }
                ),
                "CollateralLock/invalid-collateral-amount",
                "Should not be able to lock collateral if amount is invalid"
            )
        })
    })

    describe('Unlock Collateral', async () => {

        let secretA1, secretB1
        beforeEach(async () => {
            // Borrower secret / secretHash
            let borrowerLoansCount = await crosschainLoans.userLoansCount(borrower)
            secretA1 = sha256(web3.eth.accounts.sign(`SecretA1. Nonce ${borrowerLoansCount}`, borrowerPrivateKey))
            let secretHashA1 = `0x${sha256(secretA1)}`

            // Lender secret / secretHash
            let lenderLoansCount = await crosschainLoans.userLoansCount(lender)
            secretB1 = sha256(web3.eth.accounts.sign(`SecretB1. Nonce: ${lenderLoansCount}`, lenderPrivateKey))
            let secretHashB1 = `0x${sha256(secretB1)}`

            await aggregatorTest.updateAnswer(initialPrice, { from: owner })

            // Lock Collateral Details
            const collateral = '9000000000000000000'
            await collateralLock.lockCollateral(
                lender,
                secretHashA1,
                secretHashB1,
                bCoinBorrower,
                bCoinLoanId,
                bCoin,
                { from: borrower, value: collateral }
            )
        })

        it('should unlock collateral', async () => {            
            let loan = await collateralLock.fetchLoan(1)
            const collateral = loan.details[0].toString()
            const initialBalance = await web3.eth.getBalance(borrower)
            await collateralLock.unlockCollateralAndCloseLoan(1, `0x${secretB1}`)
            const finalBalance = await web3.eth.getBalance(borrower)
            loan = await collateralLock.fetchLoan(1)
            const testBalance = BigNumber(collateral).plus(initialBalance.toString())
            assert.equal(finalBalance, fromExponential(testBalance.toString()), 'Invalid final balance')
            assert.equal(loan.state, '2', 'Invalid loan state')
            assert.equal(loan.details[0], '0', 'Invalid final collateral')
            const events = await collateralLock.getPastEvents('UnlockAndClose', {
                fromBlock: 0, toBlock: 'latest'
            })
            assert.equal(events[0].event, 'UnlockAndClose', 'UnlockAndClose event not emitted')
        })

        it('should fail to unlock collateral if state is not locked', async () => {
            await collateralLock.unlockCollateralAndCloseLoan(1, `0x${secretB1}`)
            await truffleAssert.reverts(
                collateralLock.unlockCollateralAndCloseLoan(1, `0x${secretB1}`),
                "CollateralLock/collateral-not-locked",
                "Should not unlock collateral if state is not locked"
            )
        })

        it('should fail to unlock collateral if loan period expired', async () => {
            await helper.advanceTimeAndBlock(SECONDS_IN_DAY * 40)
            await truffleAssert.reverts(
                collateralLock.unlockCollateralAndCloseLoan(1, `0x${secretB1}`),
                "CollateralLock/loan-period-expired",
                "Should not unlock collateral if loan period expired"
            )
        })

        it('should fail to unlock collateral if secretB1 is invalid', async () => {
            await truffleAssert.reverts(
                collateralLock.unlockCollateralAndCloseLoan(1, `0x${secretA1}`),
                "CollateralLock/invalid-secretB1",
                "Should not unlock collateral if secretB1 is invalid"
            )
        })
    })

    describe('Seize Collateral', async () => {
        let secretA1, secretB1
        beforeEach(async () => {
            // Borrower secret / secretHash
            let borrowerLoansCount = await crosschainLoans.userLoansCount(borrower)
            secretA1 = sha256(web3.eth.accounts.sign(`SecretA1. Nonce ${borrowerLoansCount}`, borrowerPrivateKey))
            let secretHashA1 = `0x${sha256(secretA1)}`

            // Lender secret / secretHash
            let lenderLoansCount = await crosschainLoans.userLoansCount(lender)
            secretB1 = sha256(web3.eth.accounts.sign(`SecretB1. Nonce: ${lenderLoansCount}`, lenderPrivateKey))
            let secretHashB1 = `0x${sha256(secretB1)}`

            await aggregatorTest.updateAnswer(initialPrice, { from: owner })

            // Lock Collateral Details
            const collateral = '9000000000000000000'
            await collateralLock.lockCollateral(
                aCoinLender,
                secretHashA1,
                secretHashB1,
                bCoinBorrower,
                bCoinLoanId,
                bCoin,
                { from: borrower, value: collateral }
            )
        })

        it('should seize collateral', async () => {            
            await helper.advanceTimeAndBlock(SECONDS_IN_DAY * 34)

            // Initial Loan & Balance
            const loan = await collateralLock.fetchLoan(1)
            const lenderInitialBalance = await web3.eth.getBalance(aCoinLender)
            const borrowerInitialBalance = await web3.eth.getBalance(borrower)

            // Seize collateral
            const tx = await collateralLock.seizeCollateral(1, `0x${secretA1}`, { from: aCoinLender })
            const gasUsed = tx.receipt.gasUsed

            // Calculate seizable & refundable collateral
            const collateralValue = loan.details[1]
            const latestPrice = BigNumber(await aggregatorTest.latestAnswer()).multipliedBy(1e10)
            const seizableCollateral = parseInt(collateralValue) / parseInt(latestPrice)
            const refundableCollateral = BigNumber(loan.details[0]).minus(seizableCollateral)

            // Final Loan & Balance
            const lenderFinalBalance = await web3.eth.getBalance(aCoinLender)
            const borrowerFinalBalance = await web3.eth.getBalance(borrower)
            const gas = '1373260000000000'
            const testLenderFinalBalance = BigNumber(seizableCollateral.toString()).plus(lenderInitialBalance.toString()).minus(gas)
            const testBorrowerFinalBalance = BigNumber(refundableCollateral.toString()).plus(borrowerInitialBalance.toString())
            const loan_final = await collateralLock.fetchLoan(1)

            // Contract balance
            const contractBalance = await web3.eth.getBalance(collateralLock.address)

            assert.equal(loan_final.state, '1', 'Invalid loan state')
            assert.equal(loan_final.details[0].toString(), '0', 'Invalid refundable collateral')
            assert.equal(lenderFinalBalance, fromExponential(testLenderFinalBalance.toString()), 'Invalid lender\'s final balance')
            assert.equal(borrowerFinalBalance, fromExponential(testBorrowerFinalBalance.toString()), 'Invalid borrower\'s final balance')
            assert.equal(contractBalance.toString(), '0', 'Invalid contract balance')

            const events1 = await collateralLock.getPastEvents('SeizeCollateral', {
                fromBlock: 0, toBlock: 'latest'
            })
            const events2 = await collateralLock.getPastEvents('UnlockRefundableCollateral', {
                fromBlock: 0, toBlock: 'latest'
            })
            assert.equal(events1[0].event, 'SeizeCollateral', 'SeizeCollateral event not emitted')
            assert.equal(events2[0].event, 'UnlockRefundableCollateral', 'UnlockRefundableCollateral event not emitted')
        })

        it('should fail to seize collateral if secretA1 is invalid', async () => {
            await helper.advanceTimeAndBlock(SECONDS_IN_DAY * 34)
            await truffleAssert.reverts(
                collateralLock.seizeCollateral(1, `0x${secretB1}`, { from: aCoinLender }),
                "CollateralLock/invalid-secret-A1",
                "Should not be able to seize collateral if secretA1 is invalid"
            )
        })

        it('should fail to seize collateral if loan period is still active', async () => {
            await truffleAssert.reverts(
                collateralLock.seizeCollateral(1, `0x${secretA1}`, { from: aCoinLender }),
                "CollateralLock/loan-period-active",
                "Should not be able to seize collateral if loan period is still active"
            )
        })

        it('should fail to seize collateral 2 times', async () => {
            await helper.advanceTimeAndBlock(SECONDS_IN_DAY * 34)
            await collateralLock.seizeCollateral(1, `0x${secretA1}`, { from: aCoinLender })
            await truffleAssert.reverts(
                collateralLock.seizeCollateral(1, `0x${secretA1}`, { from: aCoinLender }),
                "CollateralLock/collateral-not-locked",
                "Should not be able to seize collateral more than 1 time"
            )
        })
    })

})