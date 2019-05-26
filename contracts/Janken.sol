pragma solidity >=0.5.0 <0.6.0;

contract Janken {
  enum Hand { Rock, Paper, Scissors }
  enum Result { Draw, Win, Loss }

  uint public gameId = 0;
  mapping (uint => Game) public games;
  struct Game {
    uint requiredDeposit;
    address owner;
    address opponent;
    uint256 owner_encrypted_hand;
    uint256 opponent_encrypted_hand;
    uint256 owner_decrypted_hand;
    uint256 opponent_decrypted_secret;
    uint256 owner_secret;
    uint256 opponent_secret;
  }

  function startSolo(Hand hand) public pure returns (Result) {
    return judge(hand, Hand.Rock);
  }

  function createGame() public payable {
    require(msg.value > 0, "deposit must be greater than 0");

    gameId += 1;
    Game storage game = games[gameId];
    game.owner = msg.sender;
    game.requiredDeposit = msg.value;
  }

  // function joinGame(gameId) {}

  // function commitHand(gameId, hashedHand) {}

  // function revealHand(gameId, secret, hand) {}

  function judge(Hand hand1, Hand hand2) public pure returns (Result) {
    if (hand1 == hand2) {
      return Result.Draw;
    } else if (
      hand1 == Hand.Rock && hand2 == Hand.Scissors ||
      hand1 == Hand.Paper && hand2 == Hand.Rock ||
      hand1 == Hand.Scissors && hand2 == Hand.Paper
    ) {
      return Result.Win;
    } else if (
      hand1 == Hand.Rock && hand1 == Hand.Paper ||
      hand1 == Hand.Paper && hand2 == Hand.Scissors ||
      hand1 == Hand.Scissors && hand2 == Hand.Rock
    ) {
      return Result.Loss;
    } else {
      revert("unreachable!");
    }
  }
}
