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
const DAI = artifacts.require('./DAI.sol')
const HTTP_PROVIDER = 'http://localhost:7545'

let collateralLock, aggregatorTest, crosschainLoans, token, token_2
const SECONDS_IN_DAY = 86400

contract('Crosschain Loans End to End', async () => {
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

    // CollateralLock Globals 
    const collateralLock_loanExpirationPeriod = 2851200 // 33 days
    const collateralizationRatio = 150e18
    const initialPrice = '541000'

    // CrosschainLoans AssetType Settings  
    const minLoanAmount = '100000000000000000000'
    const maxLoanAmount = '10000000000000000000000'
    const baseRatePerYear = '55000000000000000' // 0.05
    const multiplierPerYear = '1000000000000000000' // 1.2

    // CrosschainLoans Globals
    const secondsPerYear = 31556952
    const crosschainLoans_loanExpirationPeriod = 2592000 // 30 days
    const acceptExpirationPeriod = 259200 // 3 days

    const web3 = new Web3(HTTP_PROVIDER)
    const bCoinLoanId = '1'
    const bCoin = web3.utils.fromAscii('ethereum')

    beforeEach(async () => {

        // Deploy Token
        token = await DAI.new({ from: owner })

        // Deploy Second Token

        // Deploy Crosschain Loans
        crosschainLoans = await CrosschainLoans.new({ from: owner })

        // Add AssetType to Crosschain Loans
        await crosschainLoans.addAssetType(
            token.address,
            maxLoanAmount,
            minLoanAmount,
            baseRatePerYear,
            multiplierPerYear
        )

        // Deploy Collateral Lock
        collateralLock = await CollateralLock.new({ from: owner })
        aggregatorTest = await AggregatorTest.new({ from: owner })
        await collateralLock.modifyLoanParameters(web3.utils.fromAscii('priceFeed'), aggregatorTest.address)
        await aggregatorTest.updateAnswer(initialPrice, { from: owner })
    })

    describe('Regular Loan', () => {
        it('should createLoan, lockCollateral, setBorrowerAndApprove, withdraw, payback, acceptRepayment, unlockCollateral', async () => {
            // Lender secretB1 / secretHashB1
            let lenderLoansCount = await crosschainLoans.userLoansCount(lender)
            let secretB1 = sha256(web3.eth.accounts.sign(`SecretB1. Nonce: ${lenderLoansCount}`, lenderPrivateKey))
            let secretHashB1 = `0x${sha256(secretB1)}`

            // AutoLender secretAutoB1 / secretHashAutoB1
            let lenderAutoLoansCount = await crosschainLoans.userLoansCount(lenderAuto)
            let secretAutoB1 = sha256(web3.eth.accounts.sign(`SecretB1. Nonce: ${lenderAutoLoansCount}`, lenderAutoPrivateKey))
            let secretHashAutoB1 = `0x${sha256(secretAutoB1)}`

            // Borrower secretA1 /secretHashA1
            let borrowerLoansCount = await crosschainLoans.userLoansCount(borrower)
            let secretA1 = sha256(web3.eth.accounts.sign(`SecretA1. Nonce: ${borrowerLoansCount}`, borrowerPrivateKey))
            let secretHashA1 = `0x${sha256(secretA1)}`

            const principal = '1000000000000000000000'// 1,000
            const lenderInitialBalance = '10000000000000000000000' // 10,000

            // Transfer amount to lender
            await token.transfer(lender, lenderInitialBalance, { from: owner })

            // Approve Allowance (Lender)
            await token.approve(crosschainLoans.address, '1000000000000000000000000', { from: lender })

            await crosschainLoans.createLoan(
                lenderAuto,
                secretHashB1,
                secretHashAutoB1,
                principal,
                token.address,
                aCoinLender,
                { from: lender }
            )

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

            await crosschainLoans.setBorrowerAndApprove(
                '1',
                borrower,
                secretHashA1,
                { from: lender }
            )

            await crosschainLoans.withdraw(
                '1',
                `0x${secretA1}`
            )

            // Payback
            await token.transfer(borrower, '2000000000000000000000', { from: owner })
            await token.approve(crosschainLoans.address, '1000000000000000000000000', { from: borrower })
            await crosschainLoans.payback('1', { from: borrower })

            // Accept Repayment
            await crosschainLoans.acceptRepayment('1', `0x${secretB1}`, { from: lender })

            // Unlock Collateral
            await collateralLock.unlockCollateralAndCloseLoan('1', `0x${secretB1}`)

            const loan = await crosschainLoans.fetchLoan(1)
            const collateral_loan = await collateralLock.fetchLoan(1)

            const crosschainLoans_balance = await token.balanceOf(crosschainLoans.address)
            const collateralLock_balance = await web3.eth.getBalance(collateralLock.address)

            assert.equal(loan.state, '6', 'Invalid CrosschainLoans state')
            assert.equal(collateral_loan.state, '2', 'Invalid CollateralLock state')
            assert.equal(crosschainLoans_balance, '0', 'Invalid CrosschainLoans final balance')
            assert.equal(collateralLock_balance, '0', 'Invalid CollateralLock final balance')
        })
    })
})