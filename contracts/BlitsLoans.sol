pragma solidity ^0.6.0;
import "openzeppelin-solidity/contracts/token/ERC20/ERC20.sol";
import "openzeppelin-solidity/contracts/math/SafeMath.sol";

contract BlitsLoans {
    using SafeMath for uint256;
    
    mapping(uint256 => Loan) loans;
    uint256 loanIdCounter;
    
    // Global settings
    address owner;
    bool contractIsActive = false;
    uint256 approveExpirationIncrement =  21600; // 6 hours
    uint256 loanExpirationIncrement = 2592000; // 30 days
    uint256 acceptExpirationIncrement = 259200; // 3 days    
    
    uint256 baseRatePerPeriod;
    uint256 multiplierPerPeriod;
    uint256 secondsPerYear = 31556952;
    
    uint256 cash = 0;
    uint256 borrows = 0;

    enum State {
        Open,
        Funded,
        Approved,
        Withdrawn,
        Repaid,
        PaybackRefunded,
        Closed,
        Canceled
    }

    struct Loan {
        // Actors
        address payable borrower;
        address payable lender;
        address lenderAuto;
        // Hashes
        bytes32 secretHashA1;
        bytes32 secretHashB1;
        bytes32 secretHashAutoB1;
        // Secrets
        bytes32 secretA1;
        bytes32 secretB1;
        bytes32 secretAutoB1;
        // Expiration Dates
        uint256 approveExpiration;
        uint256 loanExpiration;
        uint256 acceptExpiration;
        // Loan Details
        uint256 principal;
        uint256 interest;
        // Loan State
        State state;
        // token
        ERC20 token;
    }

    constructor() public {
        owner = msg.sender;
    }

    modifier onlyOwner {
        require(msg.sender == owner, 'Not owner');
        _;
    }

    modifier isActive {
        require(contractIsActive == true, 'Contract is paused');
        _;
    }

    function setGlobalVariables(
        uint256 _baseRatePerYear, 
        uint256 _multiplierPerYear, 
        uint256 _approveExpirationIncrement,
        uint256 _loanExpirationIncrement,
        uint256 _acceptExpirationIncrement,
        bool _contractIsActive
    ) public onlyOwner {
        uint256 baseRatePerSecond = _baseRatePerYear.div(secondsPerYear);
        uint256 multiplierPerSecond = _multiplierPerYear.div(secondsPerYear);
        baseRatePerPeriod = loanExpirationIncrement.mul(baseRatePerSecond);
        multiplierPerPeriod = loanExpirationIncrement.mul(multiplierPerSecond);
        approveExpirationIncrement = _approveExpirationIncrement;
        loanExpirationIncrement = _loanExpirationIncrement;
        acceptExpirationIncrement = _acceptExpirationIncrement;
        contractIsActive = _contractIsActive;
    }
    
    function utilizationRate(uint256 _cash, uint256 _borrows) public pure returns (uint256) {
        if(_borrows == 0) {
            return 0;
        }
        
        return _borrows.mul(1e18).div(_cash.add(_borrows));
    }
    
    function getInterestRate() public view returns(uint256) {
        uint256 ur = utilizationRate(cash, borrows);
        return ur.mul(multiplierPerPeriod).div(1e18).add(baseRatePerPeriod);
    }

    
    function createLoan(
        // actors
        address _lenderAuto,
        // secret Hashes
        bytes32 _secretHashB1,
        bytes32 _secretHashAutoB1,
        // loan details
        uint256 _principal,
        address _tokenAdress
    ) public isActive returns (uint256 loanId) {
        
        require(_principal > 0, "Enter a valid principal amount");
        
        // Check allowance
        ERC20 token = ERC20(_tokenAdress);
        uint256 allowance = token.allowance(msg.sender, address(this));
        require(allowance >= _principal, "Check the token allowance");
        
        // Transfer Token
        token.transferFrom(
            msg.sender,
            address(this),
            _principal
        );
        
        // Increment loanIdCounter
        loanIdCounter = loanIdCounter + 1;

        // Add Loan to mapping
        loans[loanIdCounter] = Loan({ // Actors
            borrower: address(0),
            lender: msg.sender,
            lenderAuto: _lenderAuto, // Secret Hashes
            secretHashA1: "",
            secretHashB1: _secretHashB1,
            secretHashAutoB1: _secretHashAutoB1, // Secrets
            secretA1: "",
            secretB1: "",
            secretAutoB1: "", // Expiration dates
            approveExpiration: now.add(approveExpirationIncrement),
            loanExpiration: now.add(loanExpirationIncrement),
            acceptExpiration: now.add(acceptExpirationIncrement), // Loan details
            principal: _principal,
            interest: _principal.mul(getInterestRate()).div(1e18),
            token: token, // Loan state
            state: State.Funded
        });
        
        // Increase cash
        cash = cash.add(_principal);

        // Emit event
        emit LoanCreated(loanIdCounter);

        return loanIdCounter;
    }
    
    function getContractData() public view returns 
    (
        uint256 _loanIdCounter,
        bool _contractIsActive,
        uint256[3] memory _expirationIncrements,
        uint256 _baseRatePerPeriod,
        uint256 _multiplierPerPeriod,
        uint256 _cash,
        uint256 _borrows
    ) {
        _loanIdCounter = loanIdCounter;
        _contractIsActive = contractIsActive;
        _expirationIncrements = [approveExpirationIncrement,loanExpirationIncrement,acceptExpirationIncrement];
        _baseRatePerPeriod = baseRatePerPeriod;
        _multiplierPerPeriod = multiplierPerPeriod;
        _cash = cash;
        _borrows = borrows;
    }

    function fetchLoan(uint256 _loanId)
        public
        view
        returns (
            address[3] memory actors,
            bytes32[3] memory secretHashes,
            bytes32[3] memory secrets,
            uint256[3] memory expirations,
            uint256[2] memory details,
            State state,
            ERC20 token
        )
    {
        actors = [
            loans[_loanId].borrower,
            loans[_loanId].lender,
            loans[_loanId].lenderAuto
        ];
        secretHashes = [
            loans[_loanId].secretHashA1,
            loans[_loanId].secretHashB1,
            loans[_loanId].secretHashAutoB1
        ];
        secrets = [
            loans[_loanId].secretA1,
            loans[_loanId].secretB1,
            loans[_loanId].secretAutoB1
        ];
        expirations = [
            loans[_loanId].approveExpiration,
            loans[_loanId].loanExpiration,
            loans[_loanId].acceptExpiration
        ];
        state = loans[_loanId].state;
        details = [loans[_loanId].principal, loans[_loanId].interest];
        token = loans[_loanId].token;
    }
    

    function setBorrowerAndApprove(
        uint256 _loanId,
        address payable _borrower,
        bytes32 _secretHashA1
    ) public {
        require(loans[_loanId].state == State.Funded);
        require(now <= loans[_loanId].approveExpiration);
        require(
            msg.sender == loans[_loanId].lender ||
                msg.sender == loans[_loanId].lenderAuto
        );
        loans[_loanId].state = State.Approved;
        loans[_loanId].borrower = _borrower;
        loans[_loanId].secretHashA1 = _secretHashA1;
        emit LoanAssignedAndApproved(
            _loanId,
            _borrower,
            _secretHashA1,
            loans[_loanId].state
        );
    }

    function withdraw(uint256 _loanId, bytes32 _secretA1) public {
        require(loans[_loanId].state == State.Approved);
        require(
            sha256(abi.encodePacked(_secretA1)) == loans[_loanId].secretHashA1
        );
        loans[_loanId].state = State.Withdrawn;
        loans[_loanId].secretA1 = _secretA1;
        
        loans[_loanId].token.transfer(
            loans[_loanId].borrower,
            loans[_loanId].principal
        );
        
        borrows = borrows.add(loans[_loanId].principal);
        
        emit LoanPrincipalWithdrawn(
            _loanId,
            loans[_loanId].borrower,
            loans[_loanId].principal,
            _secretA1,
            loans[_loanId].state
        );
    }

    function acceptRepayment(uint256 _loanId, bytes32 _secretB1) public {
        require(
            sha256(abi.encodePacked(_secretB1)) ==
                loans[_loanId].secretHashB1 ||
                sha256(abi.encodePacked(_secretB1)) ==
                loans[_loanId].secretHashAutoB1,
            "Invalid secret"
        );
        require(
            now <= loans[_loanId].acceptExpiration,
            "Accept period expired"
        );
        require(
            loans[_loanId].state == State.Repaid,
            "The loan has not been repaid"
        );
        
        loans[_loanId].state = State.Closed;
        uint256 repayment = loans[_loanId].principal.add(
            loans[_loanId].interest
        );
        loans[_loanId].token.transfer(loans[_loanId].lender, repayment);

        emit LoanRepaymentAccepted(_loanId, repayment, loans[_loanId].state);
    }

    function cancelLoanBeforePrincipalWithdraw(
        uint256 _loanId,
        bytes32 _secretB1
    ) public {
        require(
            sha256(abi.encodePacked(_secretB1)) ==
                loans[_loanId].secretHashB1 ||
                sha256(abi.encodePacked(_secretB1)) ==
                loans[_loanId].secretHashAutoB1,
            "Invalid secret"
        );
        require(now <= loans[_loanId].acceptExpiration);
        require(
            loans[_loanId].state == State.Funded ||
                loans[_loanId].state == State.Approved
        );
        loans[_loanId].state = State.Canceled;
        uint256 principal = loans[_loanId].principal;
        loans[_loanId].principal = 0;
        cash = cash.sub(principal);
        loans[_loanId].token.transfer(loans[_loanId].lender, principal);
        emit CancelLoan(_loanId, _secretB1, loans[_loanId].state);
    }

    function payback(uint256 _loanId) public {
        require(loans[_loanId].state == State.Withdrawn);
        require(now <= loans[_loanId].loanExpiration);
        
        uint256 repayment = loans[_loanId].principal.add(
            loans[_loanId].interest
        );
        loans[_loanId].state = State.Repaid;
        loans[_loanId].token.transferFrom(
            loans[_loanId].borrower,
            address(this),
            repayment
        );
        emit Payback(
            _loanId,
            loans[_loanId].borrower,
            repayment,
            loans[_loanId].state
        );
    }

    function refundPayback(uint256 _loanId) public {
        require(now > loans[_loanId].acceptExpiration);
        require(loans[_loanId].state == State.Repaid);
        require(msg.sender == loans[_loanId].borrower);
        loans[_loanId].state = State.PaybackRefunded;
        uint256 refund = loans[_loanId].principal.add(loans[_loanId].interest);
        loans[_loanId].principal = 0;
        loans[_loanId].interest = 0;
        loans[_loanId].token.transfer(loans[_loanId].borrower, refund);
        emit RefundPayback(
            _loanId,
            loans[_loanId].borrower,
            refund,
            loans[_loanId].state
        );
    }

    // Events
    event LoanCreated(uint256 loanId);
    event LoanFunded(uint256 loanId, uint256 amount, State state);
    event LoanAssignedAndApproved(
        uint256 loanId,
        address borrower,
        bytes32 secretHashA1,
        State state
    );
    event LoanPrincipalWithdrawn(
        uint256 loanId,
        address borrower,
        uint256 amount,
        bytes32 secretA1,
        State state
    );
    event LoanRepaymentAccepted(uint256 loanId, uint256 amount, State state);
    event CancelLoan(uint256 loanId, bytes32 secretB1, State state);
    event Payback(
        uint256 loanId,
        address borrower,
        uint256 amount,
        State state
    );
    event RefundPayback(
        uint256 loanId,
        address borrower,
        uint256 amount,
        State state
    );
}

