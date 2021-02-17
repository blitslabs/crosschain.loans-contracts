pragma solidity ^0.6.0;
import "./AssetTypes.sol";
import "./interfaces/IBEP20.sol";

interface MasterChef {
    function deposit(uint256 _pid, uint256 _amount) external;
    function withdraw(uint256 _pid, uint256 _amount) external;
}

contract CakeFarms is AssetTypes {
    MasterChef masterChef;
    IBEP20 pancake;
    bool public masterChefEnabled = false;
    mapping(address => uint256) farms;
    mapping(address => bool) farmEnabled;
    mapping(uint256 => uint256) public poolBalances;

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

    function addPoolBalance(uint256 _pid, uint256 _amount) internal {
        masterChef.deposit(_pid, _amount);
        poolBalances[_pid] = poolBalances[_pid].add(_amount);
    }

    function removePoolBalance(uint256 _pid, uint256 _amount) internal {
        masterChef.withdraw(_pid, _amount);
        poolBalances[_pid] = poolBalances[_pid].sub(_amount);
    }

    function getRewards(uint256 _principal, address _token)
        public
        view
        returns (uint256)
    {
        uint256 pid = getFarmPID(_token);

        // Calculate principal share
        uint256 totalBalance = poolBalances[pid];
        uint256 share = 0;

        if (totalBalance > 0) {
            share = _principal.mul(pancake.balanceOf(address(this))).div(
                totalBalance
            );
        }

        return share;
    }
}
