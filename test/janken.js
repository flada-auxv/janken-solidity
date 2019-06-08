/* eslint-env mocha */

const Janken = artifacts.require('Janken');
const truffleAssert = require('truffle-assertions');
const { time } = require('openzeppelin-test-helpers');

const { soliditySha3, toBN, toWei } = web3.utils;

const HAND = {
  NULL: 0,
  ROCK: 1,
  PAPER: 2,
  SCISSORS: 3,
};

function createEncryptedHand(hand, hashedSecret) {
  return soliditySha3({ type: 'uint', value: hand }, { type: 'bytes32', value: hashedSecret });
}

async function calcFeeFromTxReceipt(receipt) {
  const tx = await web3.eth.getTransaction(receipt.tx);
  const gasUsed = toBN(receipt.receipt.gasUsed);
  const gasPrice = toBN(tx.gasPrice);
  return gasPrice.mul(gasUsed);
}

const encryptedHand = createEncryptedHand(HAND.ROCK, soliditySha3('vanilla salt'));
const encryptedHandRock = encryptedHand;
const encryptedHandScissors = createEncryptedHand(HAND.SCISSORS, soliditySha3('orange'));
const encryptedHandPaper = createEncryptedHand(HAND.PAPER, soliditySha3('prepared'));


contract('Janken', (accounts) => {
  let instance;
  const deploy = async () => {
    instance = await Janken.new();
  };

  describe('failed test for travis', () => {
    it('fails', () => { assert.equal(1, 2); });
  });

  describe('createGame', () => {
    beforeEach(deploy);

    context('with sending a few ETH', () => {
      it('should create new game and save deposit amount', async () => {
        await instance.createGame(encryptedHand, { from: accounts[0], value: toWei('1', 'finney') });
        assert.equal(1, await instance.gameId.call());

        const firstGame = await instance.games.call(1);
        assert.equal(accounts[0], firstGame.host);
        assert.equal(toWei('1', 'finney'), await instance.depositOf(1, accounts[0]));

        await instance.createGame(encryptedHand, { from: accounts[1], value: toWei('42', 'finney') });
        assert.equal(2, await instance.gameId.call());

        const secondGame = await instance.games.call(2);
        assert.equal(accounts[1], secondGame.host);
        assert.equal(toWei('42', 'finney'), await instance.depositOf(2, accounts[1]));
      });
    });

    context('without sending any ETH', () => {
      it('should revert', async () => {
        await truffleAssert.reverts(
          instance.createGame(encryptedHand),
          'deposit must be greater than minDeposit',
        );
      });
    });

    describe('waitingWindow', () => {
      it('sets deadlineToJoin in 1 day', async () => {
        const timeAtSendingTx = Math.floor(Date.now() / 1000);
        await instance.createGame(encryptedHand, { from: accounts[0], value: toWei('1', 'finney') });

        const game = await instance.games.call(1);
        assert.closeTo(timeAtSendingTx + (60 * 60 * 24), game.deadlineToJoin.toNumber(), 3);
      });
    });
  });

  describe('joinGame', () => {
    beforeEach(async () => {
      await deploy();
      await instance.createGame(encryptedHand, { from: accounts[0], value: toWei('1', 'finney') });
    });

    context('when depositing the same amount of deposit', () => {
      it('should update the game', async () => {
        await instance.joinGame(1, encryptedHand, { from: accounts[1], value: toWei('1', 'finney') });

        const game = await instance.games.call(1);
        assert.equal(accounts[1], game.opponent);
      });
    });

    context('when specified wrong gameId', () => {
      it('should revert', async () => {
        await truffleAssert.reverts(
          instance.joinGame(42, encryptedHand, { from: accounts[1], value: toWei('1', 'finney') }),
          'the game does not exist',
        );
      });
    });

    context('when depositing the not same amount of deposit', () => {
      it('should revert', async () => {
        await truffleAssert.reverts(
          instance.joinGame(1, encryptedHand, { from: accounts[1], value: toWei('3', 'finney') }),
          'deposit amount must be equal the game host\'s amount',
        );
      });
    });

    context('the commitment deadline of the game is over', () => {
      beforeEach(async () => {
        await deploy();
        await instance.createGame(encryptedHandRock, { from: accounts[0], value: toWei('1', 'finney') });
        time.increase(time.duration.days(3));
      });

      it('should revert', async () => {
        await truffleAssert.reverts(
          instance.joinGame(1, encryptedHand, { from: accounts[1], value: toWei('1', 'finney') }),
          'the game was closed for participation',
        );
      });
    });
  });

  describe('revealHand', () => {
    beforeEach(async () => {
      await deploy();
      await instance.createGame(encryptedHandRock, { from: accounts[0], value: toWei('1', 'finney') });
      await instance.joinGame(1, encryptedHandScissors, { from: accounts[1], value: toWei('1', 'finney') });
    });

    context('the deadline to reveal has passed', () => {
      beforeEach(async () => {
        time.increase(time.duration.days(3));
      });

      it('should revert', async () => {
        await truffleAssert.reverts(
          instance.revealHand(1, HAND.ROCK, soliditySha3('vanilla salt'), { from: accounts[0] }),
          'the deadline to reveal your hand of this game has passed',
        );
      });
    });

    describe('commit verification and save its result', () => {
      context('when msg.sender is the game host', () => {
        it('should update host side attributes of the game', async () => {
          const secret = soliditySha3('vanilla salt');
          await instance.revealHand(1, HAND.ROCK, secret, { from: accounts[0] });

          const game = await instance.games.call(1);
          assert.equal(HAND.ROCK, game.hostDecryptedHand);
          assert.equal(secret, game.hostSecret);
        });
      });

      context('when msg.sender is the opponent', () => {
        it('should update opponent side attributes of the game', async () => {
          const secret = soliditySha3('orange');
          await instance.revealHand(1, HAND.SCISSORS, secret, { from: accounts[1] });

          const game = await instance.games.call(1);
          assert.equal(HAND.SCISSORS, game.opponentDecryptedHand);
          assert.equal(secret, game.opponentSecret);
        });
      });
      context('when a hand which is passed is different from the originally used hand', () => {
        it('should revert', async () => {
          const secret = soliditySha3('orange');

          await truffleAssert.reverts(
            instance.revealHand(1, HAND.ROCK, secret, { from: accounts[1] }),
            'commit verification is failed',
          );
        });
      });

      context('when a secret which is passed is different from the originally used secret', () => {
        it('should revert', async () => {
          const secret = soliditySha3('apple');

          await truffleAssert.reverts(
            instance.revealHand(1, HAND.SCISSORS, secret, { from: accounts[1] }),
            'commit verification is failed',
          );
        });
      });
    });

    describe('save the result', () => {
      context('when the host wins', () => {
        it('should update result of the game', async () => {
          await instance.revealHand(1, HAND.ROCK, soliditySha3('vanilla salt'), { from: accounts[0] });
          await instance.revealHand(1, HAND.SCISSORS, soliditySha3('orange'), { from: accounts[1] });

          assert.equal(toWei('2', 'finney'), await instance.getAllowedWithdrawalAmount.call(1, accounts[0]));
          assert.equal(toWei('0', 'finney'), await instance.getAllowedWithdrawalAmount.call(1, accounts[1]));
        });
      });

      context('when the host loses', () => {
        it('should update result of the game', async () => {
          await instance.createGame(encryptedHandPaper, { from: accounts[0], value: toWei('1', 'finney') });
          await instance.joinGame(2, encryptedHandScissors, { from: accounts[1], value: toWei('1', 'finney') });
          await instance.revealHand(2, HAND.PAPER, soliditySha3('prepared'), { from: accounts[0] });
          await instance.revealHand(2, HAND.SCISSORS, soliditySha3('orange'), { from: accounts[1] });

          assert.equal(toWei('0', 'finney'), await instance.getAllowedWithdrawalAmount.call(2, accounts[0]));
          assert.equal(toWei('2', 'finney'), await instance.getAllowedWithdrawalAmount.call(2, accounts[1]));
        });
      });

      context('when the game ends in a draw', () => {
        it('should update result of the game', async () => {
          await instance.createGame(createEncryptedHand(HAND.ROCK, soliditySha3('tiger')), { from: accounts[0], value: toWei('1', 'finney') });
          await instance.joinGame(2, createEncryptedHand(HAND.ROCK, soliditySha3('dragon')), { from: accounts[1], value: toWei('1', 'finney') });
          await instance.revealHand(2, HAND.ROCK, soliditySha3('dragon'), { from: accounts[1] });
          await instance.revealHand(2, HAND.ROCK, soliditySha3('tiger'), { from: accounts[0] });

          assert.equal(toWei('1', 'finney'), await instance.getAllowedWithdrawalAmount.call(2, accounts[0]));
          assert.equal(toWei('1', 'finney'), await instance.getAllowedWithdrawalAmount.call(2, accounts[1]));
        });
      });
    });
  });

  describe('withdraw', () => {
    context('when the host wins', () => {
      beforeEach(async () => {
        await deploy();
        await instance.createGame(encryptedHandRock, { from: accounts[0], value: toWei('3', 'finney') });
        await instance.joinGame(1, encryptedHandScissors, { from: accounts[1], value: toWei('3', 'finney') });
        await instance.revealHand(1, HAND.SCISSORS, soliditySha3('orange'), { from: accounts[1] });
        await instance.revealHand(1, HAND.ROCK, soliditySha3('vanilla salt'), { from: accounts[0] });
      });

      context('when the host tries to withdraw', () => {
        it('should withdraw all deposits', async () => {
          const beforeBalance = toBN(await web3.eth.getBalance(accounts[0]));
          const receipt = await instance.withdraw(1, { from: accounts[0] });
          const afterBalance = toBN(await web3.eth.getBalance(accounts[0]));

          const fee = await calcFeeFromTxReceipt(receipt);
          const delta = afterBalance.sub(beforeBalance).toString(10);
          const deltaWithoutFee = toBN(toWei('6', 'finney'));

          assert.equal(delta, deltaWithoutFee.sub(fee).toString(10));
        });
      });

      context('when the host tries to withdraw twice', async () => {
        it('should revert', async () => {
          // the contract receive enough eth to be withdrawn from the host twice
          instance.sendTransaction({ from: accounts[1], value: toWei('10', 'finney') });

          const beforeBalance = toBN(await web3.eth.getBalance(accounts[0]));
          const receipt = await instance.withdraw(1, { from: accounts[0] });
          const afterBalance = toBN(await web3.eth.getBalance(accounts[0]));

          const fee = await calcFeeFromTxReceipt(receipt);
          const delta = afterBalance.sub(beforeBalance).toString(10);
          const deltaWithoutFee = toBN(toWei('6', 'finney'));

          assert.equal(delta, deltaWithoutFee.sub(fee).toString(10));

          await truffleAssert.reverts(
            instance.withdraw(1, { from: accounts[0] }),
            'you aren\'t eligible to withdraw',
          );
        });
      });

      context('when the opponent tries to withdraw', () => {
        it('should reverts', async () => {
          truffleAssert.reverts(
            instance.withdraw(1, { from: accounts[1] }),
            'you aren\'t eligible to withdraw',
          );
        });
      });
    });

    context('when the game ends in a draw', () => {
      beforeEach(async () => {
        await deploy();
        await instance.createGame(encryptedHandRock, { from: accounts[0], value: toWei('1.5', 'finney') });
        await instance.joinGame(1, encryptedHandRock, { from: accounts[1], value: toWei('1.5', 'finney') });
        await instance.revealHand(1, HAND.ROCK, soliditySha3('vanilla salt'), { from: accounts[0] });
        await instance.revealHand(1, HAND.ROCK, soliditySha3('vanilla salt'), { from: accounts[1] });
      });

      context('when the host tries to withdraw', () => {
        it('should withdraw deposits the only amount of deposited by myself', async () => {
          const beforeHostBalance = toBN(await web3.eth.getBalance(accounts[0]));
          const hostReceipt = await instance.withdraw(1, { from: accounts[0] });
          const afterHostBalance = toBN(await web3.eth.getBalance(accounts[0]));

          const hostFee = await calcFeeFromTxReceipt(hostReceipt);
          const hostDelta = afterHostBalance.sub(beforeHostBalance).toString(10);
          const hostDeltaWithoutFee = toBN(toWei('1.5', 'finney'));

          assert.equal(hostDelta, hostDeltaWithoutFee.sub(hostFee).toString(10));

          const beforeOpponentBalance = toBN(await web3.eth.getBalance(accounts[1]));
          const opponentReceipt = await instance.withdraw(1, { from: accounts[1] });
          const afterOpponentBalance = toBN(await web3.eth.getBalance(accounts[1]));

          const opponentFee = await calcFeeFromTxReceipt(opponentReceipt);
          const opponentDelta = afterOpponentBalance.sub(beforeOpponentBalance).toString(10);
          const opponentDeltaWithoutFee = toBN(toWei('1.5', 'finney'));

          assert.equal(opponentDelta, opponentDeltaWithoutFee.sub(opponentFee).toString(10));
        });
      });
    });
  });

  describe('rescue', () => {
    context('the game does not exist yet', () => {
      beforeEach(deploy);

      it('should revert', async () => {
        await truffleAssert.reverts(
          instance.rescue(42, { from: accounts[0] }),
          'forbidden',
        );
      });
    });

    context('game.status == Created', () => {
      context('the commitment deadline of the game is still open', () => {
        beforeEach(async () => {
          await deploy();
          await instance.createGame(encryptedHandRock, { from: accounts[0], value: toWei('1', 'finney') });
        });

        it('should revert', async () => {
          await truffleAssert.reverts(
            instance.rescue(1, { from: accounts[0] }),
            'invalid rescue',
          );
        });
      });

      context('the commitment deadline of the game is over', () => {
        beforeEach(async () => {
          await deploy();

          // the contract receive enough eth to be called `rescue` from the host twice
          instance.sendTransaction({ from: accounts[9], value: toWei('10', 'finney') });

          await instance.createGame(encryptedHandRock, { from: accounts[0], value: toWei('1', 'finney') });

          time.increase(time.duration.days(3));
        });

        it('can rescue host\'s deposit', async () => {
          const beforeBalance = toBN(await web3.eth.getBalance(accounts[0]));
          const receipt = await instance.rescue(1, { from: accounts[0] });
          const afterBalance = toBN(await web3.eth.getBalance(accounts[0]));

          const fee = await calcFeeFromTxReceipt(receipt);
          const delta = afterBalance.sub(beforeBalance).toString(10);
          const deltaWithoutFee = toBN(toWei('1', 'finney'));

          assert.equal(delta, deltaWithoutFee.sub(fee).toString(10));
        });

        context('calling rescue twice', () => {
          it('should revert', async () => {
            const beforeBalance = toBN(await web3.eth.getBalance(accounts[0]));
            const receipt = await instance.rescue(1, { from: accounts[0] });
            const afterBalance = toBN(await web3.eth.getBalance(accounts[0]));

            const fee = await calcFeeFromTxReceipt(receipt);
            const delta = afterBalance.sub(beforeBalance).toString(10);
            const deltaWithoutFee = toBN(toWei('1', 'finney'));

            assert.equal(delta, deltaWithoutFee.sub(fee).toString(10));

            await truffleAssert.reverts(
              instance.rescue(1, { from: accounts[0] }),
              'invalid rescue',
            );
          });
        });
      });
    });

    context('game.status == Started', () => {
      beforeEach(async () => {
        await deploy();
        await instance.createGame(encryptedHandRock, { from: accounts[0], value: toWei('2', 'finney') });
        await instance.joinGame(1, encryptedHandPaper, { from: accounts[1], value: toWei('2', 'finney') });
      });

      context('the deadline to reveal has passed and no one has revealed themselves hand', () => {
        beforeEach(() => {
          time.increase(time.duration.days(3));
        });

        it('should revert', async () => {
          await truffleAssert.reverts(
            instance.rescue(1, { from: accounts[0] }),
            'invalid rescue',
          );

          await truffleAssert.reverts(
            instance.rescue(1, { from: accounts[1] }),
            'invalid rescue',
          );
        });
      });

      context('the deadline to reveal has passed after only the host has revealed his hand', () => {
        beforeEach(async () => {
          await instance.revealHand(1, HAND.ROCK, soliditySha3('vanilla salt'), { from: accounts[0] });
          time.increase(time.duration.days(3));
        });

        context('calling from the host', () => {
          it('can rescue by the tx sent from the host', async () => {
            const beforeBalance = toBN(await web3.eth.getBalance(accounts[0]));
            const receipt = await instance.rescue(1, { from: accounts[0] });
            const afterBalance = toBN(await web3.eth.getBalance(accounts[0]));

            const fee = await calcFeeFromTxReceipt(receipt);
            const delta = afterBalance.sub(beforeBalance).toString(10);
            const deltaWithoutFee = toBN(toWei('4', 'finney'));

            assert.equal(delta, deltaWithoutFee.sub(fee).toString(10));
          });

          context('calling twice', () => {
            it('should revert', async () => {
              const beforeBalance = toBN(await web3.eth.getBalance(accounts[0]));
              const receipt = await instance.rescue(1, { from: accounts[0] });
              const afterBalance = toBN(await web3.eth.getBalance(accounts[0]));

              const fee = await calcFeeFromTxReceipt(receipt);
              const delta = afterBalance.sub(beforeBalance).toString(10);
              const deltaWithoutFee = toBN(toWei('4', 'finney'));

              assert.equal(delta, deltaWithoutFee.sub(fee).toString(10));

              await truffleAssert.reverts(
                instance.rescue(1, { from: accounts[0] }),
                'invalid rescue',
              );
            });
          });
        });

        context('calling from the opponent', () => {
          it('should revert', async () => {
            await truffleAssert.reverts(
              instance.rescue(1, { from: accounts[1] }),
              'invalid rescue',
            );
          });
        });
      });
    });

    context('game.status == AcceptingWithdrawal', () => {
      beforeEach(async () => {
        await deploy();
        await instance.createGame(encryptedHandRock, { from: accounts[0], value: toWei('1', 'finney') });
        await instance.joinGame(1, encryptedHandPaper, { from: accounts[1], value: toWei('1', 'finney') });
        await instance.revealHand(1, HAND.ROCK, soliditySha3('vanilla salt'), { from: accounts[0] });
        await instance.revealHand(1, HAND.PAPER, soliditySha3('prepared'), { from: accounts[1] });
      });

      it('should revert', async () => {
        await truffleAssert.reverts(
          instance.rescue(1, { from: accounts[0] }),
          'invalid rescue',
        );

        await truffleAssert.reverts(
          instance.rescue(1, { from: accounts[1] }),
          'invalid rescue',
        );
      });
    });

    context('game.status == Finished', () => {
      beforeEach(async () => {
        await deploy();
        await instance.createGame(encryptedHandRock, { from: accounts[0], value: toWei('1', 'finney') });
        await instance.joinGame(1, encryptedHandPaper, { from: accounts[1], value: toWei('1', 'finney') });
        await instance.revealHand(1, HAND.ROCK, soliditySha3('vanilla salt'), { from: accounts[0] });
        await instance.revealHand(1, HAND.PAPER, soliditySha3('prepared'), { from: accounts[1] });
        await instance.withdraw(1, { from: accounts[1] });
      });

      it('should revert', async () => {
        await truffleAssert.reverts(
          instance.rescue(1, { from: accounts[0] }),
          'invalid rescue',
        );

        await truffleAssert.reverts(
          instance.rescue(1, { from: accounts[1] }),
          'invalid rescue',
        );
      });
    });
  });
});
