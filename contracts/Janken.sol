pragma solidity >=0.5.0 <0.6.0;

import "openzeppelin-solidity/contracts/math/SafeMath.sol";

contract Janken {
    using SafeMath for uint256;

    struct Game {
        GameStatus status;
        address host;
        address opponent;
        bytes32 hostEncryptedHand;
        bytes32 opponentEncryptedHand;
        Hand hostDecryptedHand;
        Hand opponentDecryptedHand;
        bytes32 hostSecret;
        bytes32 opponentSecret;
        uint256 commitmentDeadline;
        uint256 revelationDeadline;
        mapping (address => uint256) deposits;
        mapping (address => uint256) allowedWithdrawal;
    }

    enum Hand { Null, Rock, Paper, Scissors }
    enum Result { Null, Draw, Win, Loss }
    enum GameStatus {
        DoesNotExist,
        Created,
        Started,
        AcceptingWithdrawal,
        Finished
    }

    uint256 public gameId = 0;
    uint256 public defaultWaitingWindow = 1 days;
    mapping (uint256 => Game) public games;

    constructor() public payable {}
    function () external payable {}

    event Created(
        uint256 gameId,
        address host,
        uint256 deposit,
        uint256 deadlineToJoin
    );
    event Started(
        uint256 gameId,
        address host,
        address opponent,
        uint256 deposit,
        uint256 deadlineToReveal
    );
    event AcceptingWithdrawal(
        uint256 gameId,
        address host,
        address opponent,
        uint256 hostAllowedAmountToWithdrawal,
        uint256 opponentAllowedAmountToWithdrawal
    );

    function createGame(bytes32 encryptedHand) public payable {
        require(msg.value > 0, "deposit must be greater than 0");

        gameId += 1;
        Game storage game = games[gameId];
        game.host = msg.sender;
        game.deposits[msg.sender] = msg.value;
        game.hostEncryptedHand = encryptedHand;
        // solium-disable-next-line security/no-block-members
        game.commitmentDeadline = block.timestamp.add(defaultWaitingWindow);
        game.status = GameStatus.Created;

        emit Created(
            gameId,
            game.host,
            game.deposits[game.host],
            game.commitmentDeadline
        );
    }

    function joinGame(uint256 id, bytes32 encryptedHand) public payable {
        Game storage game = games[id];

        require(game.status != GameStatus.DoesNotExist, "the game does not exist");
        gameStatusShouldBe(game, GameStatus.Created);
        require(msg.value == game.deposits[game.host], "deposit amount must be equal the game host's amount");
        require(hasNotOver(game.commitmentDeadline), "the game was closed for participation");

        game.opponent = msg.sender;
        game.deposits[msg.sender] = msg.value;
        game.opponentEncryptedHand = encryptedHand;
        // solium-disable-next-line security/no-block-members
        game.revelationDeadline = block.timestamp.add(defaultWaitingWindow);
        game.status = GameStatus.Started;

        emit Started(
            gameId,
            game.host,
            game.opponent,
            game.deposits[game.opponent],
            game.revelationDeadline
        );
    }

    function revealHand(uint256 id, uint256 handInt, bytes32 secret) public {
        Game storage game = games[id];

        gameStatusShouldBe(game, GameStatus.Started);
        restrictAccessOnlyParticipants(game, msg.sender);
        require(hasNotOver(game.revelationDeadline), "the deadline to reveal your hand of this game has passed");

        Hand hand = convertIntToHand(handInt);
        bytes32 eHand = encryptedHand(handInt, secret);

        if (msg.sender == game.host) {
            require(game.hostEncryptedHand == eHand, "commit verification is failed");
            game.hostDecryptedHand = hand;
            game.hostSecret = secret;
        } else if (msg.sender == game.opponent) {
            require(game.opponentEncryptedHand == eHand, "commit verification is failed");
            game.opponentDecryptedHand = hand;
            game.opponentSecret = secret;
        }

        if (game.hostDecryptedHand != Hand.Null && game.opponentDecryptedHand != Hand.Null) {
            Result result = judge(game.hostDecryptedHand, game.opponentDecryptedHand);
            if (result == Result.Win) {
                game.allowedWithdrawal[game.host] = game.deposits[game.host].mul(2);
            } else if (result == Result.Loss) {
                game.allowedWithdrawal[game.opponent] = game.deposits[game.opponent].mul(2);
            } else if (result == Result.Draw) {
                game.allowedWithdrawal[game.host] = game.deposits[game.host];
                game.allowedWithdrawal[game.opponent] = game.deposits[game.opponent];
            }
            game.status = GameStatus.AcceptingWithdrawal;

            emit AcceptingWithdrawal(
                gameId,
                game.host,
                game.opponent,
                game.allowedWithdrawal[game.host],
                game.allowedWithdrawal[game.opponent]
            );
        }
    }

    function withdraw(uint256 id) public {
        Game storage game = games[id];

        gameStatusShouldBe(game, GameStatus.AcceptingWithdrawal);
        restrictAccessOnlyParticipants(game, msg.sender);

        uint256 allowedAmount = game.allowedWithdrawal[msg.sender];

        require(allowedAmount != 0, "you aren't eligible to withdraw");

        game.allowedWithdrawal[msg.sender] = 0;
        msg.sender.transfer(allowedAmount);
    }

    function rescue(uint256 id) public {
        Game storage game = games[id];

        restrictAccessOnlyParticipants(game, msg.sender);

        require(isAllowedToRescueAtCreated(game) || isAllowedToRescueAtStarted(game), "invalid rescue");

        uint256 hostDeposit = game.deposits[game.host];
        uint256 opponentDeposit = game.deposits[game.opponent];

        game.deposits[game.host] = 0;
        game.deposits[game.opponent] = 0;

        msg.sender.transfer(hostDeposit.add(opponentDeposit));
    }

    function getAllowedWithdrawalAmount(uint256 id, address addr) public view returns (uint256) {
        Game storage game = games[id];
        return game.allowedWithdrawal[addr];
    }

    function depositOf(uint id, address addr) public view returns (uint256) {
        Game storage game = games[id];
        return game.deposits[addr];
    }

    function judge(Hand hand1, Hand hand2) public pure returns (Result) {
        if (hand1 == hand2) {
            return Result.Draw;
        } else if (
         (hand1 == Hand.Rock && hand2 == Hand.Scissors) ||
         (hand1 == Hand.Paper && hand2 == Hand.Rock) ||
         (hand1 == Hand.Scissors && hand2 == Hand.Paper)
        ) {
            return Result.Win;
        } else if (
         (hand1 == Hand.Rock && hand2 == Hand.Paper) ||
         (hand1 == Hand.Paper && hand2 == Hand.Scissors) ||
         (hand1 == Hand.Scissors && hand2 == Hand.Rock)
        ) {
            return Result.Loss;
        } else {
            revert("unreachable!");
        }
    }

    function isAllowedToRescueAtCreated(Game storage game) private view returns(bool) {
        return game.status == GameStatus.Created &&
        msg.sender == game.host &&
        game.deposits[game.host] != 0 &&
        hasOver(game.commitmentDeadline);
    }

    function isAllowedToRescueAtStarted(Game storage game) private view returns(bool) {
        return game.status == GameStatus.Started &&
        isRevealed(game, msg.sender) &&
        game.deposits[game.host] != 0 &&
        game.deposits[game.opponent] != 0 &&
        hasOver(game.revelationDeadline);
    }

    function hasOver(uint256 time) private view returns(bool) {
        // solium-disable-next-line security/no-block-members
        return block.timestamp > time;
    }

    function hasNotOver(uint256 time) private view returns(bool) {
        return !hasOver(time);
    }

    function isRevealed(Game memory game, address addr) private pure returns(bool) {
        if (addr == game.host) {
            return game.hostDecryptedHand != Hand.Null;
        } else if (addr == game.opponent) {
            return game.opponentDecryptedHand != Hand.Null;
        } else {
            revert("Unknown player");
        }
    }

    function restrictAccessOnlyParticipants(Game memory game, address sender) private pure {
        require(sender == game.host || sender == game.opponent, "forbidden");
    }

    function gameStatusShouldBe(Game memory game, GameStatus status) private pure {
        require(game.status == status, "status is invalid");
    }

    function convertIntToHand(uint256 handInt) private pure returns (Hand) {
        if (handInt == 0) {
            revert("Invalid value");
        } else if (handInt == 1) {
            return Hand.Rock;
        } else if (handInt == 2) {
            return Hand.Paper;
        } else if (handInt == 3) {
            return Hand.Scissors;
        } else {
            revert("Unknown value");
        }
    }

    function encryptedHand(uint256 handInt, bytes32 secret) private pure returns (bytes32) {
        return keccak256(abi.encodePacked(handInt, secret));
    }
}
