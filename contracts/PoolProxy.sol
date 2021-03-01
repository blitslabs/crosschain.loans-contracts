pragma solidity ^0.5.16;
import "./interfaces/IBEP20.sol";

interface PoolManager {
    function deposit(uint256 _pid, uint256 _amount) external;

    function withdraw(uint256 _pid, uint256 _amount) external;
}

contract PoolProxy {
    address public owner;
    PoolManager poolManager;

    modifier onlyOwner {
        require(msg.sender == owner, "PoolProxy/invalid-owner");
        _;
    }

    constructor(
        address _owner,
        address _poolManager,
        address _rewardToken
    ) public onlyOwner {
        owner = _owner;
        poolManager = PoolManager(_poolManager);
    }

    function deposit(
        uint256 _pid,
        uint256 _amount,
        address _token
    ) public onlyOwner {
        // Approve Allowance
        IBEP20 token = IBEP20(_token);
        token.approve(address(poolManager), _amount);

        // Deposit funds
        poolManager.deposit(_pid, _amount);
    }

    function withdraw(
        uint256 _pid,
        address _to,
        uint256 _amount,
        address _token
    ) public onlyOwner {
        // Withdraw from pool
        poolManager.withdraw(_pid, _amount);

        // Send tokens
        IBEP20 token = IBEP20(_token);
        token.transfer(_to, _amount);
    }

    function payRewards(address _to, address _token)
        public
        onlyOwner
        returns (uint256)
    {
        IBEP20 token = IBEP20(_token);

        // Get Balance
        uint256 balance = token.balanceOf(address(this));

        // Send tokens
        token.transfer(_to, balance);

        return balance;
    }
}
