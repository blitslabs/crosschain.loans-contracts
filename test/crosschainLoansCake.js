const truffleAssert = require('truffle-assertions')
const CrosschainLoansCake = artifacts.require('./CrosschainLoansCake.sol')

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
            const event = await crosschainLoansCake.saveReferrer(account1);
            truffleAssert.eventNotEmitted(event, "NewReferral", (ev)=>true)
        })
    })

});
