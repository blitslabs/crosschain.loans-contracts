pragma solidity ^0.6.0;
import "./AssetTypes.sol";
import "./interfaces/IBEP20.sol";
import "./PoolProxy.sol";

interface MasterChef {
    function deposit(uint256 _pid, uint256 _amount) external;

    function withdraw(uint256 _pid, uint256 _amount) external;
}

contract PoolProxyManager is AssetTypes {
    MasterChef masterChef;
    IBEP20 pancake;
    bool public masterChefEnabled = false;
    mapping(address => uint256) farms;
    mapping(address => bool) farmEnabled;
    mapping(address => address) public accountProxies;

    function setMasterChef(address _masterChef) public isAuthorized {
        require(_masterChef != address(0), "CakeFarms/invalid-chef-address");
        masterChef = MasterChef(_masterChef);
    }

    function toggleMasterChef(bool enabled) public isAuthorized {
        masterChefEnabled = enabled;
    }

    function setPancakeToken(address _contract) public isAuthorized {
        pancake = IBEP20(_contract);
    }

    function setTokenFarm(address _token, uint256 _pid) public isAuthorized {
        farms[_token] = _pid;
    }

    function toggleFarmEnabled(address _token, bool enabled)
        public
        isAuthorized
    {
        farmEnabled[_token] = enabled;
    }

    function isFarmEnabled(address _token) public view returns (bool) {
        return farmEnabled[_token];
    }

    function getFarmPID(address _token) public view returns (uint256) {
        return farms[_token];
    }

    function depositToPool(
        address _from,
        uint256 _amount,
        address _token
    ) internal {
        // Check if account has PoolProxy

        // Create PoolProxy
        PoolProxy poolProxy = new PoolProxy(address(this), address(masterChef));

        // Save PoolProxy
        accountProxies[_from] = poolProxy;

        // Send Funds to address(this) contract
        IBEP20 token = IBEP20(_token);
        token.transferFrom(_from, address(this), _amount);

        // Send Funds to PoolProxy
        token.transfer(address(poolProxy), _amount);

        // Deposit Funds into Pool
        poolProxy.deposit(getFarmPID(_token), _amount, _token);

        // Emit Event
        emit DepositPoolBalance(_from, _amount, _token);
    }

    function withdrawFromPool(
        address _to,
        uint256 _amount,
        address _token,
        address _rewardsRecipient
    ) internal {
        // Get PoolProxy
        PoolProxy poolProxy = PoolProxy(accountProxies[msg.sender]);

        // Withdraw Funds from pool
        poolProxy.withdraw(getFarmPID(_token), _to, _amount, _token);

        // Pay Rewards
        uint256 rewards =
            poolProxy.payRewards(_rewardsRecipient, address(pancake));

        emit WithdrawPoolBalance(_to, _amount, _token);
        emit PayPoolRewards(_rewardsRecipient, address(pancake), rewards);
    }

    event DepositPoolBalance(address _account, uint256 _amount, address _token);
    event WithdrawPoolBalance(
        address _account,
        uint256 _amount,
        address _token
    );
    event PayPoolRewards(address _account, address _token, uint256 _amount);
}
