pragma solidity ^0.5.16;
import "openzeppelin-solidity/contracts/token/ERC20/ERC20.sol";
import "openzeppelin-solidity/contracts/math/SafeMath.sol";
import "./AssetTypes.sol";
import "hardhat/console.sol";

interface CToken {
    function balanceOf(address owner) external view returns (uint256 balance);

    function mint(uint256 mintAmount) external returns (uint256);

    function redeem(uint256 redeemTokens) external returns (uint256);

    function redeemUnderlying(uint256 redeemAmount) external returns (uint256);

    function exchangeRateCurrent() external returns (uint256);
}

contract MoneyMarketManager is AssetTypes {
    using SafeMath for uint256;

    struct MoneyMarket {
        bool isEnabled;
        CToken market;
        mapping(uint256 => uint256) balances;
    }

    mapping(address => MoneyMarket) public moneyMarkets;

    /**
     * @notice Add a money market
     * @param _token The address of the underlying ERC20 token
     * @param _marketAddress The address of the money market
     */
    function addMoneyMarket(address _token, address _marketAddress)
        external
        isAuthorized
        contractIsEnabled
    {
        require(
            moneyMarkets[_token].isEnabled == false,
            "MoneyMarketMager/market-already-exists"
        );
        moneyMarkets[_token] = MoneyMarket({
            isEnabled: true,
            market: CToken(_marketAddress)
        });
    }

    /**
     * @notice Modify money market params
     * @param _token The address of the money market underlyng token
     * @param _status The status of the money market
     */
    function toggleMoneyMarket(address _token, bool _status)
        external
        isAuthorized
        contractIsEnabled
    {
        moneyMarkets[_token].isEnabled = _status;
    }

    /**
     * @notice Modify the address of the money market
     * @param _token The address of the money market undelying token
     * @param _market The address of the money market
     */
    function modifyMoneyMarket(address _token, CToken _market)
        external
        isAuthorized
        contractIsEnabled
    {
        moneyMarkets[_token].market = _market;
    }

    /**
     * @notice Deposit funds from money market
     * @param _amount The number of underlying tokens to deposit
     * @param _token The underlying token to deposit
     * @return Boolean indicating success or failure
     */
    function depositMoney(
        uint256 _loanId,
        uint256 _amount,
        address _token
    ) internal returns (bool) {
        require(
            moneyMarkets[_token].isEnabled == true,
            "MoneyMarketManager/money-market-disabled"
        );

        // Check allowance
        require(
            approveAllowance(
                _token,
                address(moneyMarkets[_token].market),
                _amount
            ),
            "MoneyMarketManager/insufficient-allowance"
        );

        // Mint mmTokens
        require(
            moneyMarkets[_token].market.mint(_amount) == 0,
            "MoneyMarketManager/money-market-mint-failed"
        );

        // Add mmTokens to balance
        uint256 mmTokens =
            _amount.mul(1e18).div(
                moneyMarkets[_token].market.exchangeRateCurrent()
            );
        moneyMarkets[_token].balances[_loanId] = moneyMarkets[_token].balances[
            _loanId
        ]
            .add(mmTokens);
        return true;
    }

    /**
     * @notice Withdraw funds from money market
     * @param _amount The number of underlying tokens to redeem
     * @param _token The underlying token to redeem
     * @return Boolean indicating success or failure
     */
    function withdrawMoney(
        uint256 _loanId,
        address _lender,
        uint256 _amount,
        address _token
    ) internal returns (bool) {
        // Check if money market is enabled
        require(
            moneyMarkets[_token].isEnabled,
            "MoneyMarketManager/money-market-disabled"
        );

        // If mmTokens > 0, send to lender
        ERC20 underlyingToken = ERC20(_token);
        uint256 balanceBefore = underlyingToken.balanceOf(address(this));
        uint256 mmTokenBalance = moneyMarkets[_token].balances[_loanId];
        moneyMarkets[_token].balances[_loanId] = 0;

        // Redeem mmTokens
        require(
            moneyMarkets[_token].market.redeem(mmTokenBalance) == 0,
            "MoneyMarketManager/money-market-redeem-failed"
        );

        uint256 balanceAfter = underlyingToken.balanceOf(address(this));
        require(balanceAfter > balanceBefore, "MoneyMarketManager/math-error");
        uint256 newPrincipal = balanceAfter.sub(balanceBefore);       

        if (newPrincipal > _amount) {
            uint256 yield = newPrincipal.sub(_amount);            
            underlyingToken.transfer(_lender, yield);
        }

        return true;
    }

    /**
     * @notice Approve the allowance between CrosschainLoans and CToken
     * @param _token The underlying ERC20 token
     * @param _spender The authorized spender
     * @param _amount The required allowance amount
     */
    function approveAllowance(
        address _token,
        address _spender,
        uint256 _amount
    ) internal returns (bool) {
        ERC20 erc20 = ERC20(_token);
        uint256 allowance = erc20.allowance(address(this), _spender);

        if (allowance < _amount) {
            erc20.approve(_spender, uint256(-1));
        }
        return true;
    }
}
