pragma solidity ^0.6.0;
import "openzeppelin-solidity/contracts/token/ERC20/ERC20.sol";
import "openzeppelin-solidity/contracts/math/SafeMath.sol";

contract BlitsLoans {
    using SafeMath for uint256;

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

    mapping(uint256 => Loan) loans;

    uint256 loanIdCounter;

    // Create new loan
    function createLoan(
        // actors
        address _lenderAuto,
        // secret Hashes
        bytes32 _secretHashB1,
        bytes32 _secretHashAutoB1,
        uint256[3] memory _expirations,
        // loan details
        uint256 _principal,
        uint256 _interest,
        address _tokenAdress
    ) public returns (uint256 loanId) {
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
            approveExpiration: _expirations[0],
            loanExpiration: _expirations[1],
            acceptExpiration: _expirations[2], // Loan details
            principal: _principal,
            interest: _interest,
            token: ERC20(_tokenAdress), // Loan state
            state: State.Open
        });

        // Emit event
        emit LoanCreated(loanIdCounter);

        return loanIdCounter;
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

    function getBytes32ArrayForInput()
        public
        pure
        returns (bytes32[2] memory b32Arr)
    {
        b32Arr = [bytes32("candidate1"), bytes32("c2")];
    }

    // Fund loan
    function fund(uint256 _loanId) public {
        require(loans[_loanId].state == State.Open);
        loans[_loanId].token.transferFrom(
            msg.sender,
            address(this),
            loans[_loanId].principal
        );
        loans[_loanId].state = State.Funded;
        emit LoanFunded(
            _loanId,
            loans[_loanId].principal,
            loans[_loanId].state
        );
    }

    // Approve loan
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

    // Withdraw loan
    // secretB1 is not necessary because we are checking state == 'approved'
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
        emit LoanPrincipalWithdrawn(
            _loanId,
            loans[_loanId].borrower,
            loans[_loanId].principal,
            _secretA1,
            loans[_loanId].state
        );
    }

    // Accept Repayment or cancel
    // secretB2 es secretB1 ya que no hay secretB1 utilizado en `approve`
    // separa accept y cancel para controlar correctamente el estado

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

        // TO-DO: enviar cantidad correcta = principal + interest
        loans[_loanId].state = State.Closed;
        uint256 repayment = loans[_loanId].principal.add(
            loans[_loanId].interest
        );
        loans[_loanId].token.transfer(loans[_loanId].lender, repayment);

        emit LoanRepaymentAccepted(_loanId, repayment, loans[_loanId].state);
    }

    // La version de atomic loans tinene una posible vulnerabilidad que permite
    // a `lender` cancelar el prestamo aunque `borrower` retirado el principal
    // Revisar si unicamente se permitira cancelar antes de ser aprovado, o aun cuando
    // no se haya retirado el principal por parte de Alice

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
        loans[_loanId].token.transfer(loans[_loanId].lender, principal);
        emit CancelLoan(_loanId, _secretB1, loans[_loanId].state);
    }

    // TO-DO
    // Only allow to repay the exact amount
    function payback(uint256 _loanId) public {
        require(loans[_loanId].state == State.Withdrawn);
        require(now <= loans[_loanId].loanExpiration);
        // require(msg.sender == loans[_loanId].borrower);
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

    // TO-DO
    // Only allow to refund payback that was actually paid, not the principal and interest (if it was a different amount)
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
