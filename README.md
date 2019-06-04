# janken-solidity

## operation flow

### create a game by player1(the host)

Generate a secret in a cryptographically secure way and hash it with your chosen hand. You need to remember the secret to prove correctness later. Also, need to send ether with that transaction as a deposit.

In `npx truffle console`:

```node
const crypto = require('crypto');
const helper = require('./test/helpers');
const { toWei } = web3.utils;

// chose your hand in 0: Rock, 1: Paper, 2: Scissors
const hostHand = 0;
const hostSecret = crypto.randomBytes(32).toString('hex');
const hostEncryptedHand = helper.createEncryptedHash(hostHand, hostSecret);
console.log(`host => encryptedHand: ${hostEncryptedHand}, secret: ${hostSecret}`);
// => host => encryptedHand: 0xddcc0ff99e92fb5def54265ee13acd54903a93b10f577c89b08203c493b866fe, secret: d9e505d9afcdd7e4847f4a105c1f367f27b3193a57935136276b4130d0d1b521

instance = await Janken.deployed()
await instance.createGame(hostEncryptedHand, { value: toWei('1') })
```

### join the game by player2(the opponent)

Commit the hand in the same way as the host. The transaction requires you to send the same amount of ether as host's deposit.

```node
const opponentHand = 1;
const opponentSecret = crypto.randomBytes(32).toString('hex');
const opponentEncryptedHand = helper.createEncryptedHash(opponentHand, opponentSecret);
console.log(`opponent => encryptedHand: ${opponentEncryptedHand}, secret: ${opponentSecret}`);

await instance.joinGame(1, opponentEncryptedHand, { value: toWei('1') })
```
