const { time, shouldFail, balance } = require('openzeppelin-test-helpers')
const CryptoJS = require('crypto-js')
const { soliditySha3 } = require("web3-utils")
const Web3 = require('web3')
const web3 = new Web3('http://localhost:7545')
const { sha256 } = require('@liquality/crypto')

const _deploy_contracts = require('../migrations/2_deploy_contracts')
const { assert } = require('chai')
const { inTransaction } = require('openzeppelin-test-helpers/src/expectEvent')

const DAI = artifacts.require('./DAI.sol')
const BlitsLoans = artifacts.require('BlitsLoans.sol');

let token, blitsLoan

contract('BlitsLoans', async (accounts) => {
    // Prepare Accounts
    const lender = accounts[0]
    const lenderAuto = accounts[1]
    const borrower = accounts[2]
    const borrowerAuto = accounts[3]

    // Prepare Timestamp increments
    const withdrawIncrement = 21600 // 90 hrs?
    const loanIncrement = 1209600 // 210 days?
    const acceptIncrement = 259200 // 45 days?
    const seizureIncrement = 1209600 // 210 days?

    // Prepare Secrets

    // Alice
    const secretA1 = "0x68205448939c9adbb5ef3af0c56031134f2946e18063b2394ed2fe1359448ce3"
    const secretHashA1 = "0x51b3905ec6df1c3bfbf4cb1298b8e6af99adda15b3b9e04cf4f39c0dd5f51c00"
    const secretA2 = "0x97b7ef7fb05bed6764c2a0666e5f55a733707867b28fd57070ffb42621b342c0"
    const secretHashA2 = "0x04a95cdf6dfed8dd8aa94a7b01b9f4c6184067f0b1eea4e5c4deb4294389c14e"

    // Bob
    const secretB1 = "0xdddf8b9aa365fccfcd65788a8b90f826b95a538dd13d3498f11c7d3ca6703557"
    const secretHashB1 = "0xe55d8eaa25b5b1f791ade455dcaabc81211e6fc2e3b72ecc18ad5efbc4e4771d"
    const secretB2 = "0x29cc07189e8d4f8066a353c137624fc91b30fc2ed83912ddf470a660576f9f2f"
    const secretHashB2 = "0x54c126152718dc41282a080479c4c6c7f779ef1685613283bdccdecbf16180ce"

    // Auto Lender (Bob)
    const secretAutoB1 = "0x64c9be3361b7fd4d4e1458a1d3a7d17c9858b04d2512719aa0c4db102576527d"
    const secretHashAutoB1 = "0x677cbf2b7fc97d7ae3977c8808e7cc250a96746ce1f7d0294b414fb91b00bae7"
    const secretAutoB2 = "0x9f7259d05ac4a50c60d298bb1bf3c3821f0c88fff298ffdf37bc7304400535d7"
    const secretHashAutoB2 = "0x55de4870a654f460a6deafe89d5a1e6dba380a8cae222a90ff3fee5902d1eaad"
    const secretAutoB3 = "0xdddf8b9aa365fccfcd65788a8b90f826b95a538dd13d3498f11c7d3ca6703557"
    const secretHashAutoB3 = "0xe55d8eaa25b5b1f791ade455dcaabc81211e6fc2e3b72ecc18ad5efbc4e4771d"

    const wrongSecret = 'WRONG_SECRET'
    const wrongSecretHash = soliditySha3(wrongSecret)

    let currentTime, approveExpiration, loanExpiration, seizureExpiration

    // Loan Details
    const principal = '10000000000000000000' // 10 DAI
    const interest = '1000000000000000000' // 1 DAI

    beforeEach(async () => {
        currentTime = parseInt(await time.latest())

        approveExpiration = currentTime + withdrawIncrement
        loanExpiration = currentTime + loanIncrement
        acceptExpiration = loanExpiration + acceptIncrement
        seizureExpiration = loanExpiration + seizureIncrement

        // Deploy test DAI
        token = await DAI.new()

        // Deplay Blits Loans contract
        blitsLoans = await BlitsLoans.new()

        // Create a New Loan Request
        await blitsLoans.createLoan(
            lenderAuto,
            secretHashB1,
            secretHashAutoB1,
            [approveExpiration, loanExpiration, acceptExpiration],
            principal,
            interest,
            token.address
        )

        // Let the Blits Loans Contract use 10 DAI Balance
        await token.approve(blitsLoans.address, '10000000000000000000', { from: lender })

        // Transfer 10 DAI to borrower
        await token.transfer(borrower, '1000000000000000000', { from: lender })

    })

    describe('Create Loan Offer', () => {
        it('should Create a New Loan Offer', async () => {
            // Create a New Loan Request
            // const loan = await blitsLoans.createLoan(
            //     lenderAuto,
            //     secretHashB1,
            //     secretHashAutoB1,
            //     [approveExpiration, loanExpiration, acceptExpiration],
            //     principal,
            //     interest,
            //     token.address
            // )
            // const loanId = loanId.logs[0].args.loanId.toString()

            const loanInfo = await blitsLoans.fetchLoan(1)
            console.log(loanInfo)
            assert.equal(lender, loanInfo.actors[1])
        })
    })

    describe('fund', async () => {
        it('should succed if msg.sender has necessary principal', async () => {
            await blitsLoans.fund(1)
            const loanInfo = await blitsLoans.fetchLoan(1)
            assert(loanInfo.state.toString(), '1')
        })
    })

    describe('set borrower and approve', async () => {
        it('should succed if autoLoan can set borrower and approve', async () => {
            await blitsLoans.fund(1)
            await blitsLoans.setBorrowerAndApprove(1, borrower, secretHashA1, { from: lenderAuto })
            const loanInfo = await blitsLoans.fetchLoan(1)
            assert(loanInfo.state.toString(), '2')
        })
    })

    describe('cancel loan before withdraw', async () => {
        it('should succed if autoLoan can cancel loan', async () => {
            await blitsLoans.fund(1)
            await blitsLoans.setBorrowerAndApprove(1, borrower, secretHashA1, { from: lender })
            await blitsLoans.cancelLoanBeforePrincipalWithdraw(1, secretAutoB1, { from: lender })
            const loanInfo = await blitsLoans.fetchLoan(1)
            assert(loanInfo.state.toString(), '7')
        })
    })

    describe('withdraw loan principal', async () => {
        it('should succed if principal can be withdrawn', async () => {
            await blitsLoans.fund(1)
            await blitsLoans.setBorrowerAndApprove(1, borrower, secretHashA1, { from: lender })
            await blitsLoans.withdraw(1, secretA1)
            const loanInfo = await blitsLoans.fetchLoan(1)
            assert(loanInfo.state.toString(), '3')
        })
    })

    describe('payback', async () => {
        it('should repay loan', async () => {
            await blitsLoans.fund(1)
            await blitsLoans.setBorrowerAndApprove(1, borrower, secretHashA1, { from: lender })
            await blitsLoans.withdraw(1, secretA1)
            await token.approve(blitsLoans.address, '11000000000000000000', { from: borrower })
            await blitsLoans.payback(1);
            const loanInfo = await blitsLoans.fetchLoan(1)
            assert(loanInfo.state.toString(), '4')
        })
    })

    describe('accept repayment', async () => {
        it('should accept repayment', async () => {
            await blitsLoans.fund(1)
            await blitsLoans.setBorrowerAndApprove(1, borrower, secretHashA1, { from: lender })
            await blitsLoans.withdraw(1, secretA1)
            await token.approve(blitsLoans.address, '11000000000000000000', { from: borrower })
            await blitsLoans.payback(1)
            await blitsLoans.acceptRepayment(1, secretB1, { from: lender })
            const loanInfo = await blitsLoans.fetchLoan(1)
            assert(loanInfo.state.toString(), '6')
        })
    })

})