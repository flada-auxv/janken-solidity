pragma solidity >=0.5.0 <0.6.0;

contract Janken {
  enum Hand { Rock, Paper, Scissors }
  enum Result { Draw, Win, Loss }

  function startSolo(Hand hand) public pure returns (Result) {
    return judge(hand, Hand.Rock);
  }

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
