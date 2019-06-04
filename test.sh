#!/usr/bin/env bash

# for restarting ganache-cli each execution of tests
# https://github.com/trufflesuite/ganache/issues/370

npx ganache-cli > /dev/null 2>&1 &
PID=$!

rm -rf ./build
npx truffle test --network test
kill ${PID}
