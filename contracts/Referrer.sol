pragma solidity ^0.6.0;
import "openzeppelin-solidity/contracts/math/SafeMath.sol";

contract Referrer {
    mapping(address => address) public referrers;
    mapping(address => address[]) public referrals;
    mapping(address => uint256) public totalReferrals;

    function saveReferrer(address _referrer) public {
        require(
            msg.sender!=_referrer,
                "Referrer/referrer-is-referral");
        if (_referrer != address(0) && referrers[msg.sender] != _referrer) {
            // Set Referrer
            referrers[msg.sender] = _referrer;
            // Save Referrer's Referrals
            referrals[_referrer].push(msg.sender);
            // Update Total Referrals
            totalReferrals[_referrer] = totalReferrals[_referrer] + 1;
            // Emit event
            emit NewReferral(msg.sender, _referrer);
        }
    }

    function getReferrer(address _account) public view returns (address) {
        return referrers[_account];
    }

    // --- Events ---
    event NewReferral(address _referral, address _referrer);
    event PayReferrer(address _referral, address _referrer, address _token, uint256 _amount);
}
