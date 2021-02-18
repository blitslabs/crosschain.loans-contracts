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
    const lenderPrivateKey = "0x3fc2446c5ebaa18be72c16cbab9e90d8bc568bb1620dc548db67287d86df93a9";

    const lenderAuto = accounts[2];
    const lenderAutoPrivateKey = "0x7a36504b3651fe9b212ee5a1db6b4d62caed00d306cdefac6f4204a84dc6f758";

    const borrower = accounts[3];
    const borrowerPrivateKey = "0x7135698447f4e32d43707f7748927c728f31ecf0ecd90c5fd2ec369164d4a794";

    const aCoinLender = accounts[4]

    let crosschainLoansCake;

    let token;

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

    describe("Loans", ()=>{


        // AssetType Settings
        const minLoanAmount = '100000000000000000000'
        const maxLoanAmount = '10000000000000000000000'
        const baseRatePerYear = '55000000000000000' // 0.05
        const multiplierPerYear = '1000000000000000000' // 1.2
        const referralFees = '200000000000000000'
        let principal, secretB1

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

});
