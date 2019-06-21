/* eslint-disable no-console */

const crypto = require('crypto');

const Janken = artifacts.require('Janken');
const { soliditySha3, toWei } = web3.utils;

module.exports = async () => {
  const accounts = await web3.eth.getAccounts();

  // ----- 1. create a game by player1 -----

  // chose your hand in Rock: 1, Paper: 2, Scissors: 3
  const hostHand = 1;
  const hostSecret = soliditySha3({ type: 'bytes32', value: crypto.randomBytes(32).toString('hex') });
  const hostEncryptedHand = soliditySha3({ type: 'uint', value: hostHand }, { type: 'bytes32', value: hostSecret });

  console.log(`host =>
  handInt: ${hostHand},
  encryptedHand: ${hostEncryptedHand},
  secret: ${hostSecret}`);
  // host =>
  // handInt: 1,
  // encryptedHand: 0x6b4b80765fbc12a1c53b5b4e49494314746073126a6770c0ba81484e4983ee7c,
  // secret: 0x66d37bcbe540b6f34a7da8eae97a1eb71fc42fb1849d1078722b9fa358986e3e

  const instance = await Janken.deployed();
  await instance.createGame(hostEncryptedHand, { value: toWei('1'), from: accounts[0] });
  const gameId = await instance.gameId.call();
  console.log('gameId => ', gameId.toNumber());


  // ----- 2. join the game as player2 -----

  const opponentHand = 2;
  const opponentSecret = soliditySha3({ type: 'bytes32', value: crypto.randomBytes(32).toString('hex') });
  const opponentEncryptedHand = soliditySha3({ type: 'uint', value: opponentHand }, { type: 'bytes32', value: opponentSecret });

  console.log(`opponent =>
  handInt: ${opponentHand},
  encryptedHand: ${opponentEncryptedHand},
  secret: ${opponentSecret}`);
  // opponent =>
  // handInt: 2,
  // encryptedHand: 0x9b71de1de0cc772612f29c0f42fa6a53a5c91d1e7b89e3f9f384ccbbf64db827,
  // secret: 0x5f1f2c0e96a0a6208ac0f5b8fcf70aa47df4d12a462871b09dfca8ee3c9cf95f

  await instance.joinGame(gameId, opponentEncryptedHand, { value: toWei('1'), from: accounts[1] });


  // ----- 3. reveal the secret -----

  await instance.revealHand(gameId, hostHand, hostSecret, { from: accounts[0] });
  await instance.revealHand(gameId, opponentHand, opponentSecret, { from: accounts[1] });


  // ----- 4. withdraw funds deposited by the two -----

  const beforeBalance = await web3.eth.getBalance(accounts[1]);
  const receipt = await instance.withdraw(gameId, { from: accounts[1] });
  const afterBalance = await web3.eth.getBalance(accounts[1]);

  const tx = await web3.eth.getTransaction(receipt.tx);
  const gasUsed = web3.utils.toBN(receipt.receipt.gasUsed);
  const gasPrice = web3.utils.toBN(tx.gasPrice);
  const fee = gasPrice.mul(gasUsed);
  const delta = afterBalance - beforeBalance;

  console.log(`result =>
    beforeBalance: ${beforeBalance},
    afterBalance: ${afterBalance},
    delta: ${delta},
    fee: ${fee},
    deltaWithoutFee: ${delta - fee}`);
};
