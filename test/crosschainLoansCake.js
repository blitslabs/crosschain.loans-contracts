const truffleAssert = require('truffle-assertions')
const CrosschainLoansCake = artifacts.require('./CrosschainLoansCake.sol')
const { assert } = require('chai')
const Web3 = require('web3')
const HTTP_PROVIDER = 'http://localhost:7545'
const helper = require('../utils/utils')
const { sha256 } = require('@liquality-dev/crypto')
const DAI = artifacts.require('./DAI.sol')


contract('CrosschainLoansCake', async (accounts) => {

    const account1 = accounts[0];

    const owner = accounts[0];

    const lender = accounts[1];
    const lenderPrivateKey = "0x9ee5d3825646335f0cd40261ee81d9b7ed44c0f8e9136ef3b1a99c4a07cea2e5";

    const lenderAuto = accounts[2];
    const lenderAutoPrivateKey = "0xf56d7713d4490a872672c03cd289371dc3b77470ff4b5c8af2ae0ab926d3342c";

    const borrower = accounts[3];
    const borrowerPrivateKey = "0x895b7047e401f87385237fe63b8f7f87a5db140c904ba30f5985b58a4aa91833";

    const aCoinLender = accounts[4]

    let crosschainLoansCake;
    let token;

    // AssetType Settings
    const minLoanAmount = '100000000000000000000'
    const maxLoanAmount = '10000000000000000000000'
    const baseRatePerYear = '55000000000000000' // 0.05
    const multiplierPerYear = '1000000000000000000' // 1.2
    const referralFees = '200000000000000000'
    let principal, secretB1


    beforeEach(async () => {
        crosschainLoansCake = await CrosschainLoansCake.new({from: account1});
        token = await DAI.new({ from: owner })
    });

    describe('Referrer', () => {
        it('should save a referrer', async () => {
            const event = await crosschainLoansCake.saveReferrer(accounts[1]);
            truffleAssert.eventEmitted(event, "NewReferral", (ev)=>true)
        })

        it('if the referrer is repeated, new referral event will not be issued', async () => {
            await crosschainLoansCake.saveReferrer(accounts[1]);
            await crosschainLoansCake.saveReferrer(accounts[2]);
            await crosschainLoansCake.saveReferrer(accounts[1]);
            let event = await crosschainLoansCake.saveReferrer(accounts[1]);
            truffleAssert.eventNotEmitted(event, "NewReferral", (ev)=>true);
        })

        it('if the referrer have the same account of sender, new referral event will not be issued', async () => {
            await truffleAssert.reverts(crosschainLoansCake.saveReferrer(account1), "Referrer/referrer-is-referral", "Referrer cannot be its referral")
        })
    })

    describe("Create Loans", ()=>{

        it("should create loan and add new referral", async () => {
            const web3 = new Web3()

            // Add AssetType
            await crosschainLoansCake.addAssetType(
                token.address,
                maxLoanAmount,
                minLoanAmount,
                baseRatePerYear,
                multiplierPerYear,
                referralFees
            )

            // Lender secret / secretHash
            let lenderLoansCount = await crosschainLoansCake.userLoansCount(lender)
            secretB1 = sha256(web3.eth.accounts.sign(`SecretB1. Nonce: ${lenderLoansCount}`, lenderPrivateKey))
            let secretHashB1 = `0x${sha256(secretB1)}`

            // AutoLender secret / secretHash
            let lenderAutoLoansCount = await crosschainLoansCake.userLoansCount(lenderAuto)
            let secretAutoB1 = sha256(web3.eth.accounts.sign(`SecretB1. Nonce: ${lenderAutoLoansCount}`, lenderAutoPrivateKey))
            let secretHashAutoB1 = `0x${sha256(secretAutoB1)}`


            // Loan #1 Details
            principal = '1000000000000000000000'// 1,000

            const lenderInitialBalance = '10000000000000000000000' // 10,000

            // Transfer amount to lender
            await token.transfer(lender, lenderInitialBalance, { from: owner })

            // Approve Allowance (Lender)
            await token.approve(crosschainLoansCake.address, '1000000000000000000000000', { from: lender })

            // Create First Loan
            const event = await crosschainLoansCake.createLoan(
                lenderAuto,
                secretHashB1,
                secretHashAutoB1,
                principal,
                token.address,
                aCoinLender,
                account1,
                { from: lender }
            );

            lenderLoansCount = await crosschainLoansCake.userLoansCount(lender);
            assert.equal(lenderLoansCount, 1, 'Invalid lender loansCount')
            truffleAssert.eventEmitted(event, "NewReferral", (ev)=>true);
        });
    })

    describe('Accept Payback', async () => {

        let snapshot, snapshotId, borrowerLoansCount, secretA1, secretHashA1, principal, secretB1, secretAutoB1

        beforeEach(async () => {

            snapshot = await helper.takeSnapshot()
            snapshotId = snapshot['result']
            const web3 = new Web3()

            // Add AssetType
            await crosschainLoansCake.addAssetType(
                token.address,
                maxLoanAmount,
                minLoanAmount,
                baseRatePerYear,
                multiplierPerYear,
                referralFees
            )

            // Lender secret / secretHash
            let lenderLoansCount = await crosschainLoansCake.userLoansCount(lender)
            secretB1 = sha256(web3.eth.accounts.sign(`SecretB1. Nonce: ${lenderLoansCount}`, lenderPrivateKey))
            let secretHashB1 = `0x${sha256(secretB1)}`

            // AutoLender secret / secretHash
            let lenderAutoLoansCount = await crosschainLoansCake.userLoansCount(lenderAuto)
            secretAutoB1 = sha256(web3.eth.accounts.sign(`SecretB1. Nonce: ${lenderAutoLoansCount}`, lenderAutoPrivateKey))
            let secretHashAutoB1 = `0x${sha256(secretAutoB1)}`

            // Borrower secret / secretHash
            borrowerLoansCount = await crosschainLoansCake.userLoansCount(borrower)
            secretA1 = sha256(web3.eth.accounts.sign(`SecretA1. Nonce: ${borrowerLoansCount}`, borrowerPrivateKey))
            secretHashA1 = `0x${sha256(secretA1)}`

            assert.equal(lenderLoansCount, '0', 'Invalid lender loansCount')

            // Loan #1 Details
            principal = '1000000000000000000000'// 1,000

            const lenderInitialBalance = '10000000000000000000000' // 10,000

            // Transfer amount to lender
            await token.transfer(lender, lenderInitialBalance, { from: owner })

            // Approve Allowance (Lender)
            await token.approve(crosschainLoansCake.address, '1000000000000000000000000', { from: lender })

            // Create First Loan
            await crosschainLoansCake.createLoan(
                lenderAuto,
                secretHashB1,
                secretHashAutoB1,
                principal,
                token.address,
                aCoinLender,
                accounts[5],
                { from: lender }
            )

            await crosschainLoansCake.setBorrowerAndApprove(
                '1',
                borrower,
                secretHashA1,
                { from: lender }
            )

            await crosschainLoansCake.withdraw(
                '1',
                `0x${secretA1}`
            )

            let loan = await crosschainLoansCake.fetchLoan(1)
            const interest = loan.details[1]
            await token.transfer(borrower, interest, { from: owner })
            await token.approve(crosschainLoansCake.address, '1000000000000000000000000', { from: borrower })
            await crosschainLoansCake.payback('1', { from: borrower })
        })

        afterEach(async () => {
            await helper.revertToSnapShot(snapshotId)
        })

        it('should accept payback (secretB1)', async () => {
            const initialBalance = await token.balanceOf(lender);
            const initialReferrerBalance = await token.balanceOf(accounts[5]);

            await crosschainLoansCake.acceptRepayment('1', `0x${secretB1}`)
            const loan = await crosschainLoansCake.fetchLoan(1)

            const finalLenderBalance = await token.balanceOf(lender)
            const finalReferrerBalance = await token.balanceOf(accounts[5]);

            const events = await crosschainLoansCake.getPastEvents('LoanRepaymentAccepted', {
                fromBlock: 0, toBlock: 'latest'
            });

            assert.equal(loan.state.toString(), '6', 'Invalid loan state')
            assert.equal(finalReferrerBalance.toString(),'903509312306207400', 'Invalid referrer balance')
            assert.equal(finalLenderBalance.toString(),'10003614037249224829600', 'Invalid lender balance')
            assert.equal(events[0].event, 'LoanRepaymentAccepted', 'LoanRepaymentAccepted event not emitted')
        })
    })
});
