pragma solidity ^0.6.0;
import "openzeppelin-solidity/contracts/math/SafeMath.sol";

contract Administration {
    using SafeMath for uint256;

    // --- Data ---
    uint256 public contractEnabled = 0;

    // --- Auth ---
    mapping(address => uint256) public authorizedAccounts;

    /**
     * @notice Add auth to an account
     * @param account Account to add auth to
     */
    function addAuthorization(address account)
        public
        isAuthorized
        contractIsEnabled
    {
        authorizedAccounts[account] = 1;
        emit AddAuthorization(account);
    }

    /**
     * @notice Remove auth from an account
     * @param account Account to add auth to
     */
    function removeAuthorization(address account)
        public
        isAuthorized
        contractIsEnabled
    {
        authorizedAccounts[account] = 0;
        emit RemoveAuthorization(account);
    }

    /**
     * @notice Checks whether msg.sender can call an authed function
     */
    modifier isAuthorized {
        require(
            authorizedAccounts[msg.sender] == 1,
            "CrosschainLoans/account-not-authorized"
        );
        _;
    }

    /**
     * @notice Checks whether the contract is enabled
     */
    modifier contractIsEnabled {
        require(contractEnabled == 1, "CrosschainLoans/contract-not-enabled");
        _;
    }

    // --- Administration ---

    function enableContract() public isAuthorized {
        contractEnabled = 1;
        emit EnableContract();
    }

    /**
     * @notice Disable this contract
     */
    function disableContract() public isAuthorized {
        contractEnabled = 0;
        emit DisableContract();
    }

    // --- Events ---
    event AddAuthorization(address account);
    event RemoveAuthorization(address account);
    event EnableContract();
    event DisableContract();
}
