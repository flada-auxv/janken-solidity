#!/usr/bin/env bash

# for restarting ganache-cli each execution of tests
# https://github.com/trufflesuite/ganache/issues/370

npx ganache-cli > /dev/null 2>&1 &
PID=$!

npx truffle test

kill ${PID}
