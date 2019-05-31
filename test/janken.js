/* eslint-env mocha */

const Janken = artifacts.require('Janken');
const truffleAssert = require('truffle-assertions');

const HAND = {
  NULL: 0,
  ROCK: 1,
  PAPER: 2,
  SCISSORS: 3,
};

const RESULT = {
  NULL: 0,
  DRAW: 1,
  WIN: 2,
  LOSS: 3,
};

let instance;
const { soliditySha3, toBN, toWei } = web3.utils;

function createEncryptedHash(hand, salt) {
  const hashedSecret = soliditySha3(salt);
  return soliditySha3({ type: 'uint', value: hand }, { type: 'bytes32', value: hashedSecret });
}
async function calcFeeFromTxReceipt(receipt) {
  const tx = await web3.eth.getTransaction(receipt.tx);
  const gasUsed = toBN(receipt.receipt.gasUsed);
  const gasPrice = toBN(tx.gasPrice);
  return gasPrice.mul(gasUsed);
}

const encryptedHand = createEncryptedHash(HAND.ROCK, 'vanilla salt');
const encryptedHandRock = encryptedHand;
const encryptedHandScissors = createEncryptedHash(HAND.SCISSORS, 'orange');


contract('Janken', (accounts) => {
  const deploy = async () => {
    instance = await Janken.new();
  };

  describe('createGame', () => {
    beforeEach(deploy);

    context('with sending a few ETH', () => {
      it('should create new game and save deposit amount', async () => {
        await instance.createGame(encryptedHand, { from: accounts[0], value: 10 });
        assert.equal(1, await instance.gameId.call());

        const firstGame = await instance.games.call(1);
        assert.equal(accounts[0], firstGame.owner);
        assert.equal(10, firstGame.requiredDeposit);

        await instance.createGame(encryptedHand, { from: accounts[1], value: 42 });
        assert.equal(2, await instance.gameId.call());

        const secondGame = await instance.games.call(2);
        assert.equal(accounts[1], secondGame.owner);
        assert.equal(42, secondGame.requiredDeposit);
      });
    });

    context('without sending any ETH', () => {
      it('should revert', async () => {
        await truffleAssert.reverts(
          instance.createGame(encryptedHand),
          'deposit must be greater than 0',
        );
      });
    });
  });

  describe('joinGame', () => {
    beforeEach(async () => {
      await deploy();
      await instance.createGame(encryptedHand, { from: accounts[0], value: 10 });
    });

    context('when depositing the same amount of requiredDeposit', () => {
      it('should update the game', async () => {
        await instance.joinGame(1, encryptedHand, { from: accounts[1], value: 10 });

        const game = await instance.games.call(1);
        assert.equal(accounts[1], game.opponent);
      });
    });

    context('when specified wrong gameId', () => {
      it('should revert', async () => {
        await truffleAssert.reverts(
          instance.joinGame(42, encryptedHand, { from: accounts[1], value: 10 }),
          'the game does not found',
        );
      });
    });

    context('when depositing the not same amount of requiredDeposit', () => {
      it('should revert', async () => {
        await truffleAssert.reverts(
          instance.joinGame(1, encryptedHand, { from: accounts[1], value: 5 }),
          'deposit amount must be equal onwer\'s amount',
        );
      });
    });
  });

  describe('revealHand', () => {
    beforeEach(async () => {
      await deploy();
      await instance.createGame(encryptedHandRock, { from: accounts[0], value: 10 });
      await instance.joinGame(1, encryptedHandScissors, { from: accounts[1], value: 10 });
    });

    describe('commit verification and save its result', () => {
      context('when msg.sender is game owner', () => {
        it('should update owner side attributes of the game', async () => {
          const secret = soliditySha3('vanilla salt');
          await instance.revealHand(1, HAND.ROCK, secret, { from: accounts[0] });

          const game = await instance.games.call(1);
          assert.equal(HAND.ROCK, game.ownerDecryptedHand);
          assert.equal(secret, game.ownerSecret);
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
      context('when owner wins', () => {
        it('should update result of the game', async () => {
          await instance.revealHand(1, HAND.ROCK, soliditySha3('vanilla salt'), { from: accounts[0] });
          await instance.revealHand(1, HAND.SCISSORS, soliditySha3('orange'), { from: accounts[1] });

          assert.equal(20, await instance.getAllowedWithdrawalAmount.call(1, accounts[0]));
          assert.equal(0, await instance.getAllowedWithdrawalAmount.call(1, accounts[1]));
        });
      });

      context('when owner loses', () => {
        it('should update result of the game', async () => {
          await instance.createGame(encryptedHandScissors, { from: accounts[0], value: 10 });
          await instance.joinGame(2, encryptedHandRock, { from: accounts[1], value: 10 });
          await instance.revealHand(2, HAND.SCISSORS, soliditySha3('orange'), { from: accounts[0] });
          await instance.revealHand(2, HAND.ROCK, soliditySha3('vanilla salt'), { from: accounts[1] });

          assert.equal(0, await instance.getAllowedWithdrawalAmount.call(2, accounts[0]));
          assert.equal(20, await instance.getAllowedWithdrawalAmount.call(2, accounts[1]));
        });
      });

      context('when result is draw', () => {
        it('should update result of the game', async () => {
          await instance.createGame(createEncryptedHash(HAND.ROCK, 'tiger'), { from: accounts[0], value: 10 });
          await instance.joinGame(2, createEncryptedHash(HAND.ROCK, 'dragon'), { from: accounts[1], value: 10 });
          await instance.revealHand(2, HAND.ROCK, soliditySha3('dragon'), { from: accounts[1] });
          await instance.revealHand(2, HAND.ROCK, soliditySha3('tiger'), { from: accounts[0] });

          assert.equal(10, await instance.getAllowedWithdrawalAmount.call(2, accounts[0]));
          assert.equal(10, await instance.getAllowedWithdrawalAmount.call(2, accounts[1]));
        });
      });
    });

    describe('withdraw', () => {
      context('when owner wins', () => {
        beforeEach(async () => {
          await deploy();
          await instance.createGame(encryptedHandRock, { from: accounts[0], value: toWei('0.015') });
          await instance.joinGame(1, encryptedHandScissors, { from: accounts[1], value: toWei('0.015') });
          await instance.revealHand(1, HAND.SCISSORS, soliditySha3('orange'), { from: accounts[1] });
          await instance.revealHand(1, HAND.ROCK, soliditySha3('vanilla salt'), { from: accounts[0] });
        });

        context('when owner tries to withdraw', () => {
          it('should withdraw all deposits', async () => {
            const beforeBalance = toBN(await web3.eth.getBalance(accounts[0]));
            const receipt = await instance.withdraw(1, { from: accounts[0] });
            const afterBalance = toBN(await web3.eth.getBalance(accounts[0]));

            const fee = await calcFeeFromTxReceipt(receipt);
            const delta = afterBalance.sub(beforeBalance).toString(10);
            const deltaWithoutFee = toBN(toWei('0.03'));

            assert.equal(delta, deltaWithoutFee.sub(fee).toString(10));
          });
        });

        context('when owner tries to withdraw twice', async () => {
          it('should revert', async () => {
            // the contract receive enough eth to be withdrawn from the owner twice
            instance.sendTransaction({ from: accounts[1], value: toWei('0.03') });

            const beforeBalance = toBN(await web3.eth.getBalance(accounts[0]));
            const receipt = await instance.withdraw(1, { from: accounts[0] });
            const afterBalance = toBN(await web3.eth.getBalance(accounts[0]));

            const fee = await calcFeeFromTxReceipt(receipt);
            const delta = afterBalance.sub(beforeBalance).toString(10);
            const deltaWithoutFee = toBN(toWei('0.03'));

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
          await instance.createGame(encryptedHandRock, { from: accounts[0], value: toWei('1') });
          await instance.joinGame(1, encryptedHandRock, { from: accounts[1], value: toWei('1') });
          await instance.revealHand(1, HAND.ROCK, soliditySha3('vanilla salt'), { from: accounts[0] });
          await instance.revealHand(1, HAND.ROCK, soliditySha3('vanilla salt'), { from: accounts[1] });
        });

        context('when owner tries to withdraw', () => {
          it('should withdraw deposits the only amount of deposited by myself', async () => {
          });
        });
      });
    });

    describe('startSolo', () => {
      beforeEach(deploy);

      it('should return the code of draw', async () => {
        const result = await instance.startSolo.call(HAND.ROCK);

        assert.equal(result, RESULT.DRAW);
      });

      it('should return the code of loss', async () => {
        const result = await instance.startSolo.call(HAND.SCISSORS);

        assert.equal(result, RESULT.LOSS);
      });

      it('should return the code of win', async () => {
        const result = await instance.startSolo.call(HAND.PAPER);

        assert.equal(result, RESULT.WIN);
      });
    });
  });
});
