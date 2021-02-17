pragma solidity ^0.6.0;
import "openzeppelin-solidity/contracts/math/SafeMath.sol";
import "./Administration.sol";

contract AssetTypes is Administration {
    using SafeMath for uint256;

    // --- Data ---
    uint256 public secondsPerYear = 31556952;
    uint256 public loanExpirationPeriod = 2592000; // 30 days
    uint256 public acceptExpirationPeriod = 259200; // 3 days

    struct AssetType {
        uint256 maxLoanAmount;
        uint256 minLoanAmount;
        uint256 supply;
        uint256 demand;
        uint256 baseRatePerPeriod;
        uint256 multiplierPerPeriod;
        uint256 enabled;
        address contractAddress;
    }

    // Data about each asset type
    mapping(address => AssetType) public assetTypes;

    /**
     * @notice Calculates the utilization rate for the given asset
     * @param _supply The total supply for the given asset
     * @param _demand The total demand for the given asset
     */
    function utilizationRate(uint256 _supply, uint256 _demand)
        public
        pure
        returns (uint256)
    {
        if (_demand == 0) {
            return 0;
        }
        return _demand.mul(1e18).div(_supply.add(_demand));
    }

    /**
     * @notice Calculates the loan period interest rate
     * @param _contractAddress The contract address of the given asset
     */
    function getAssetInterestRate(address _contractAddress)
        public
        view
        returns (uint256)
    {
        uint256 ur =
            utilizationRate(
                assetTypes[_contractAddress].supply,
                assetTypes[_contractAddress].demand
            );
        return
            ur
                .mul(assetTypes[_contractAddress].multiplierPerPeriod)
                .div(1e18)
                .add(assetTypes[_contractAddress].baseRatePerPeriod);
    }

    /**
     * @notice Get information about an Asset Type
     * @param contractAddress The contract address of the given asset
     */
    function getAssetType(address _contractAddress)
        public
        view
        returns (
            uint256 maxLoanAmount,
            uint256 minLoanAmount,
            uint256 supply,
            uint256 demand,
            uint256 baseRatePerPeriod,
            uint256 multiplierPerPeriod,
            uint256 interestRate,
            uint256 enabled,
            address contractAddress
        )
    {
        maxLoanAmount = assetTypes[_contractAddress].maxLoanAmount;
        minLoanAmount = assetTypes[_contractAddress].minLoanAmount;
        supply = assetTypes[_contractAddress].supply;
        demand = assetTypes[_contractAddress].demand;
        baseRatePerPeriod = assetTypes[_contractAddress].baseRatePerPeriod;
        multiplierPerPeriod = assetTypes[_contractAddress].multiplierPerPeriod;
        interestRate = getAssetInterestRate(_contractAddress);
        enabled = assetTypes[_contractAddress].enabled;
        contractAddress = assetTypes[_contractAddress].contractAddress;
    }

    /**
     * @notice Add AssetType
     * @param _contractAddress The contract address of the ERC20 token
     * @param _maxLoanAmount The maximum principal allowed for the token
     * @param _minLoanAmount The minimum principal allowerd for the token
     * @param _baseRatePerYear The approximate target base APR
     * @param _multiplierPerYear The rate of increase in interest rate
     */
    function addAssetType(
        address _contractAddress,
        uint256 _maxLoanAmount,
        uint256 _minLoanAmount,
        uint256 _baseRatePerYear,
        uint256 _multiplierPerYear
    ) external isAuthorized contractIsEnabled {
        require(_contractAddress != address(0));
        require(_maxLoanAmount > 0, "CrosschainLoans/invalid-maxLoanAmount");
        require(_minLoanAmount > 0, "CrosschainLoans/invalid-minLoanAmount");
        require(
            assetTypes[_contractAddress].minLoanAmount == 0,
            "CrosschainLoans/assetType-already-exists"
        );

        assetTypes[_contractAddress] = AssetType({
            contractAddress: _contractAddress,
            maxLoanAmount: _maxLoanAmount,
            minLoanAmount: _minLoanAmount,
            baseRatePerPeriod: _baseRatePerYear.mul(loanExpirationPeriod).div(
                secondsPerYear
            ),
            multiplierPerPeriod: _multiplierPerYear
                .mul(loanExpirationPeriod)
                .div(secondsPerYear),
            enabled: 1,
            supply: 0,
            demand: 0
        });
        emit AddAssetType(_contractAddress, _maxLoanAmount, _minLoanAmount);
    }

    /**
     * @notice Modify AssetType related parameters
     * @param _contractAddress The contract address of the ERC20 token
     * @param _parameter The name of the parameter modified
     * @param _data The new value for the parameter
     */
    function modifyAssetTypeLoanParameters(
        address _contractAddress,
        bytes32 _parameter,
        uint256 _data
    ) external isAuthorized contractIsEnabled {
        require(_data > 0, "CrosschainLoans/null-data");
        require(
            _contractAddress != address(0) &&
                assetTypes[_contractAddress].contractAddress != address(0),
            "CrosschainLoans/invalid-assetType"
        );
        if (_parameter == "maxLoanAmount")
            assetTypes[_contractAddress].maxLoanAmount = _data;
        else if (_parameter == "minLoanAmount")
            assetTypes[_contractAddress].minLoanAmount = _data;
        else if (_parameter == "baseRatePerYear") {
            assetTypes[_contractAddress].baseRatePerPeriod = _data
                .mul(loanExpirationPeriod)
                .div(secondsPerYear);
        } else if (_parameter == "multiplierPerYear") {
            assetTypes[_contractAddress].multiplierPerPeriod = _data
                .mul(loanExpirationPeriod)
                .div(secondsPerYear);
        } else revert("CrosschainLoans/modify-unrecognized-param");
        emit ModifyAssetTypeLoanParameters(_parameter, _data);
    }

    /**
     * @notice Modify Loan expiration periods
     * @param _parameter The name of the parameter modified
     * @param _data The new value for the parameter
     */
    function modifyLoanParameters(bytes32 _parameter, uint256 _data)
        external
        isAuthorized
        contractIsEnabled
    {
        require(_data > 0, "CrosschainLoans/null-data");
        if (_parameter == "loanExpirationPeriod") loanExpirationPeriod = _data;
        else if (_parameter == "acceptExpirationPeriod")
            acceptExpirationPeriod = _data;
        else revert("CrosschainLoans/modify-unrecognized-param");
        emit ModifyLoanParameters(_parameter, _data);
    }

    /**
     * @notice Enable AssetType
     */
    function enableAssetType(address _contractAddress)
        external
        isAuthorized
        contractIsEnabled
    {
        require(
            _contractAddress != address(0) &&
                assetTypes[_contractAddress].contractAddress != address(0),
            "CrosschainLoans/invalid-assetType"
        );
        assetTypes[_contractAddress].enabled = 1;
        emit EnableAssetType(_contractAddress);
    }

    /**
     * @notice Disable AssetType
     * @param _contractAddress The contract address of the ERC20 token
     */
    function disableAssetType(address _contractAddress)
        external
        isAuthorized
        contractIsEnabled
    {
        require(
            _contractAddress != address(0) &&
                assetTypes[_contractAddress].contractAddress != address(0),
            "CrosschainLoans/invalid-assetType"
        );
        assetTypes[_contractAddress].enabled = 0;
        emit DisableAssetType(_contractAddress);
    }

    event AddAssetType(
        address contractAddress,
        uint256 maxLoanAmount,
        uint256 minLoanAmount
    );

    event EnableAssetType(address contractAddress);
    event DisableAssetType(address contractAddress);
    event ModifyAssetTypeLoanParameters(bytes32 parameter, uint256 data);
    event ModifyLoanParameters(bytes32 parameter, uint256 data);
}
