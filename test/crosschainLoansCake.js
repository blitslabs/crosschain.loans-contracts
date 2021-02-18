const truffleAssert = require('truffle-assertions')
const CrosschainLoansCake = artifacts.require('./CrosschainLoansCake.sol')
const { assert } = require('chai')
const Web3 = require('web3')
const HTTP_PROVIDER = 'http://localhost:7545'
const helper = require('../utils/utils')

contract('CrosschainLoansCake', async (accounts) => {

    const account1 = accounts[0];
    let crosschainLoansCake;

    beforeEach(async () => {
        crosschainLoansCake = await CrosschainLoansCake.new({from: account1})
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

});
