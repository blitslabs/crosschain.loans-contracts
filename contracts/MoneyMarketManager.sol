pragma solidity ^0.5.16;
import "openzeppelin-solidity/contracts/token/ERC20/ERC20.sol";
import "openzeppelin-solidity/contracts/math/SafeMath.sol";
import "./AssetTypes.sol";

interface MoneyMarket {
    function mint(uint mintAmount) external returns (uint);
    function redeem(uint redeemTokens) external returns (uint);
    function exchangeRateCurrent() external returns (uint);
}

contract MoneyMarketManager is AssetTypes {
    using SafeMath for uint256;

    MoneyMarket moneyMarket;
    bool public moneyMarketEnabled = false;
    mapping(address => bool) marketsEnabled;
    mapping(uint256 => uint256) moneyMarketBalances;

    function setMoneyMarket(address _moneyMarket) public isAuthorized {
        require(_moneyMarket != address(0), "MoneyMarketManager/invalid-MM-address");
        moneyMarket = MoneyMarket(_moneyMarket);
    }

    function toggleMoneyMarket(bool _enabled) public isAuthorized {
        moneyMarketEnabled = _enabled;
    }

    function toggleMarketEnabled(address _token, bool _enabled) public isAuthorized {
        marketsEnabled[_token] = _enabled;
    }

    function isMarketEnabled(address _token) public view returns (bool) {
        return marketsEnabled[_token];
    }

    function depositMoney(uint256 _loanId, uint256 _amount ,address _token) internal {
        require(moneyMarketEnabled == true, "MoneyMarketManager/money-market-disabled");
        require(marketsEnabled[_token] == true, "MoneyMarketManager/token-market-disabled");
        
        // Mint mmTokens
        require(moneyMarket.mint(_amount) == 0, "MoneyMarketManager/money-market-mint-failed");
        
        // Add mmTokens to balance
        uint256 mmTokens = _amount.div(moneyMarket.exchangeRateCurrent());
        moneyMarketBalances[_loanId] = moneyMarketBalances[_loanId].add(mmTokens);
    } 

    

}