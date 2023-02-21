
hh compile

hh deploy 
hh deploy --network localhost
hh deploy --network sepolia
hh deploy --network goerli

hh deploy --tags mocks
hh deploy --tags signature

hh node
hh run scripts/main.js --network localhost
hh run scripts/main.js --network goerli
hh run scripts/withdraw.js --network localhost

hh test
hh test --network localhost
hh test --grep store 
hh test --grep "Only allows the owner to withdraw" 
hh test --network sepolia
hh coverage

hh test test/unit/Token.test.js
hh test test/unit/Exchange.test.js
yarn hardhat test --grep "Exchange tokenToTokenSwap Tests"

hh test test/unit/Factory.test.js





