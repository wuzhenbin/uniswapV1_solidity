const { assert, expect } = require("chai");
const { network, deployments, ethers } = require("hardhat");
const { developmentChains } = require("../../helper-hardhat-config");

// 调用合约使用wei
const toWei = (value) => ethers.utils.parseEther(value.toString());
// 获取合约或账户余额
const getBalance = ethers.provider.getBalance;
// 显示余额使用eth
const fromWei = (value) => ethers.utils.formatEther(value);

if (!developmentChains.includes(network.name)) {
    describe.skip;
} else {
    describe("Exchange tokenToTokenSwap Tests", async function () {
        it("swaps token for token", async () => {
            let [owner, user] = await ethers.getSigners();

            await deployments.fixture(["factory"]);
            const Factory = await ethers.getContract("Factory");

            const Exchange = await ethers.getContractFactory("Exchange");
            const Token = await ethers.getContractFactory("ERC20FixedSupply");

            // tokenA在owner手里
            // tokenB在user手里
            const TokenA = await Token.deploy("TokenA", "AAA", "10000");
            const TokenB = await Token.connect(user).deploy(
                "TokenB",
                "BBB",
                "10000"
            );
            await TokenA.deployed();
            await TokenB.deployed();

            await Factory.createExchange(TokenA.address);
            await Factory.createExchange(TokenB.address);

            const exchangeAddressA = await Factory.getExchange(TokenA.address);
            const exchangeAddressB = await Factory.getExchange(TokenB.address);

            const ExchangeA = await Exchange.attach(exchangeAddressA);
            const ExchangeB = await Exchange.attach(exchangeAddressB);

            // tokenA流动池
            await TokenA.approve(ExchangeA.address, toWei(2000));
            await ExchangeA.addLiquidity(toWei(2000), { value: toWei(1000) });
            // tokenB流动池
            await TokenB.connect(user).approve(ExchangeB.address, toWei(1000));
            await ExchangeB.connect(user).addLiquidity(toWei(1000), {
                value: toWei(1000),
            });

            // owner初始没有tokenB
            expect(await TokenB.balanceOf(owner.address)).to.equal(0);
            // tokenA 换 tokenB 先授权 A 到 ExchangeA
            await TokenA.approve(ExchangeA.address, toWei(10));
            // owner 用 tokenA 换 tokenB tokenToTokenSwap(_tokenSold,_minTokensBought, _tokenAddress)
            await ExchangeA.tokenToTokenSwap(
                toWei(10),
                toWei(4.8),
                TokenB.address
            );
            expect(fromWei(await TokenB.balanceOf(owner.address))).to.equal(
                "4.852698493489877956"
            );

            // user初始没有tokenA
            expect(await TokenA.balanceOf(user.address)).to.equal(0);
            // tokenB 换 tokenA 先授权 B 到 ExchangeB
            await TokenB.connect(user).approve(ExchangeB.address, toWei(10));
            // user 用 tokenB 换 tokenA tokenToTokenSwap(_tokenSold,_minTokensBought, _tokenAddress)
            await ExchangeB.connect(user).tokenToTokenSwap(
                toWei(10),
                toWei(19.6),
                TokenA.address
            );
            expect(fromWei(await TokenA.balanceOf(user.address))).to.equal(
                "19.602080509528011079"
            );
        });
    });

    describe("Exchange Unit Tests", function () {
        let Token, Exchange, deployer, user;

        beforeEach(async () => {
            deployer = (await getNamedAccounts()).deployer;
            [, user] = await ethers.getSigners();

            await deployments.fixture(["token", "exchange"]);
            Exchange = await ethers.getContract("Exchange");
            Token = await ethers.getContract("ERC20FixedSupply");
        });

        it("is deployed", async () => {
            assert.equal(await Exchange.name(), "Lp-Token");
            assert.equal(await Exchange.symbol(), "LP");
            assert.equal(await Exchange.totalSupply(), 0);
            assert.equal(await Exchange.factoryAddress(), deployer);
        });

        describe("getTokenAmount", async () => {
            it("returns correct token amount", async () => {
                await Token.approve(Exchange.address, toWei(2000));
                await Exchange.addLiquidity(toWei(2000), {
                    value: toWei(1000),
                });

                // 输入 eth 得到 token
                let tokensOut = await Exchange.getTokenAmount(toWei(1));
                expect(fromWei(tokensOut)).to.equal("1.978041738678708079");

                tokensOut = await Exchange.getTokenAmount(toWei(100));
                expect(fromWei(tokensOut)).to.equal("180.1637852593266606");

                tokensOut = await Exchange.getTokenAmount(toWei(1000));
                expect(fromWei(tokensOut)).to.equal("994.974874371859296482");
            });
        });

        describe("getEthAmount", async () => {
            it("returns correct ether amount", async () => {
                await Token.approve(Exchange.address, toWei(2000));
                await Exchange.addLiquidity(toWei(2000), {
                    value: toWei(1000),
                });

                let ethOut = await Exchange.getEthAmount(toWei(2));
                expect(fromWei(ethOut)).to.equal("0.989020869339354039");

                ethOut = await Exchange.getEthAmount(toWei(100));
                expect(fromWei(ethOut)).to.equal("47.16531681753215817");

                ethOut = await Exchange.getEthAmount(toWei(2000));
                expect(fromWei(ethOut)).to.equal("497.487437185929648241");
            });
        });

        describe("ethToTokenTransfer", async () => {
            beforeEach(async () => {
                await Token.approve(Exchange.address, toWei(2000));
                await Exchange.addLiquidity(toWei(2000), {
                    value: toWei(1000),
                });
            });

            it("transfers at least min amount of tokens to recipient", async () => {
                const userBalanceBefore = await getBalance(user.address);

                await Exchange.connect(user).ethToTokenTransfer(
                    toWei(1.97),
                    user.address,
                    {
                        value: toWei(1),
                    }
                );

                const userBalanceAfter = await getBalance(user.address);
                // 1+gas eth
                // expect(
                //     fromWei(userBalanceAfter.sub(userBalanceBefore))
                // ).to.equal("-1.000094788947319741");

                const userTokenBalance = await Token.balanceOf(user.address);
                // expect(fromWei(userTokenBalance)).to.equal(
                //     "1.978041738678708079"
                // );

                const exchangeEthBalance = await getBalance(Exchange.address);
                expect(fromWei(exchangeEthBalance)).to.equal("1001.0");

                const exchangeTokenBalance = await Token.balanceOf(
                    Exchange.address
                );
                // expect(fromWei(exchangeTokenBalance)).to.equal(
                //     "1998.021958261321291921"
                // );
            });
        });

        describe("ethToTokenSwap", async () => {
            beforeEach(async () => {
                await Token.approve(Exchange.address, toWei(2000));
                await Exchange.addLiquidity(toWei(2000), {
                    value: toWei(1000),
                });
            });

            it("transfers at least min amount of tokens", async () => {
                const userBalanceBefore = await getBalance(user.address);

                await Exchange.connect(user).ethToTokenSwap(toWei(1.97), {
                    value: toWei(1),
                });

                const userBalanceAfter = await getBalance(user.address);

                // expect(
                //     fromWei(userBalanceAfter.sub(userBalanceBefore))
                // ).to.equal("-1.000094050001637163");

                const userTokenBalance = await Token.balanceOf(user.address);
                // expect(fromWei(userTokenBalance)).to.equal(
                //     "1.978041738678708079"
                // );

                const exchangeEthBalance = await getBalance(Exchange.address);
                expect(fromWei(exchangeEthBalance)).to.equal("1001.0");

                const exchangeTokenBalance = await Token.balanceOf(
                    Exchange.address
                );
                // expect(fromWei(exchangeTokenBalance)).to.equal(
                //     "1998.021958261321291921"
                // );
            });

            it("affects exchange rate", async () => {
                let tokensOut = await Exchange.getTokenAmount(toWei(10));
                expect(fromWei(tokensOut)).to.equal("19.605901574413308248");

                await Exchange.connect(user).ethToTokenSwap(toWei(9), {
                    value: toWei(10),
                });

                tokensOut = await Exchange.getTokenAmount(toWei(10));
                expect(fromWei(tokensOut)).to.equal("19.223356774598792281");
            });

            it("fails when output amount is less than min amount", async () => {
                await expect(
                    Exchange.connect(user).ethToTokenSwap(toWei(2), {
                        value: toWei(1),
                    })
                ).to.be.revertedWithCustomError(
                    Exchange,
                    "Exchange__InsufficientOutput"
                );
            });
        });

        describe("tokenToEthSwap", async () => {
            beforeEach(async () => {
                // 初始状态 user 没有 token
                await Token.transfer(user.address, toWei(22));
                await Token.connect(user).approve(Exchange.address, toWei(22));

                await Token.approve(Exchange.address, toWei(2000));
                await Exchange.addLiquidity(toWei(2000), {
                    value: toWei(1000),
                });
            });

            it("transfers at least min amount of tokens", async () => {
                const userBalanceBefore = await getBalance(user.address);
                const exchangeBalanceBefore = await getBalance(
                    Exchange.address
                );

                await Exchange.connect(user).tokenToEthSwap(
                    toWei(2),
                    toWei(0.9)
                );

                const userBalanceAfter = await getBalance(user.address);
                // expect(
                //     fromWei(userBalanceAfter.sub(userBalanceBefore))
                // ).to.equal("0.988937443725299325");

                const userTokenBalance = await Token.balanceOf(user.address);
                expect(fromWei(userTokenBalance)).to.equal("20.0");

                const exchangeBalanceAfter = await getBalance(Exchange.address);
                // expect(
                //     fromWei(exchangeBalanceAfter.sub(exchangeBalanceBefore))
                // ).to.equal("-0.989020869339354039");

                const exchangeTokenBalance = await Token.balanceOf(
                    Exchange.address
                );
                expect(fromWei(exchangeTokenBalance)).to.equal("2002.0");
            });

            it("affects exchange rate", async () => {
                let ethOut = await Exchange.getEthAmount(toWei(20));
                expect(fromWei(ethOut)).to.equal("9.802950787206654124");

                await Exchange.connect(user).tokenToEthSwap(
                    toWei(20),
                    toWei(9)
                );

                ethOut = await Exchange.getEthAmount(toWei(20));
                expect(fromWei(ethOut)).to.equal("9.61167838729939614");
            });

            it("fails when output amount is less than min amount", async () => {
                await expect(
                    Exchange.connect(user).tokenToEthSwap(toWei(2), toWei(1.0))
                ).to.be.revertedWithCustomError(
                    Exchange,
                    "Exchange__InsufficientOutput"
                );
            });
        });

        describe("addLiquidity", async () => {
            // 流动池为空的时候
            describe("empty reserves", async () => {
                it("adds liquidity", async () => {
                    await Token.approve(Exchange.address, toWei(200));
                    await Exchange.addLiquidity(toWei(200), {
                        value: toWei(100),
                    });

                    let ethBalance = await getBalance(Exchange.address);
                    let tokenReserves = await Exchange.getReserve();
                    let deployerLpToken = await Exchange.balanceOf(deployer);
                    let totalSupply = await Exchange.totalSupply();

                    expect(ethBalance).to.equal(toWei(100));
                    expect(tokenReserves).to.equal(toWei(200));
                    expect(deployerLpToken).to.equal(toWei(100));
                    expect(totalSupply).to.equal(toWei(100));
                });
            });
            // 有流动性的情况
            describe("existing reserves", async () => {
                let tokenInit = toWei(200);
                let ethInit = toWei(100);

                beforeEach(async () => {
                    // 转入200-token 100-eth的流动性
                    await Token.approve(Exchange.address, toWei(300));
                    await Exchange.addLiquidity(tokenInit, {
                        value: ethInit,
                    });
                });

                it("add more liquidity", async () => {
                    let inputEth = toWei(50);
                    let inputToken = toWei(200);

                    await Exchange.addLiquidity(inputToken, {
                        value: inputEth,
                    });
                    // 根据初始比例 算得 投入最多的token数量为 100
                    let ethBalance = await getBalance(Exchange.address);
                    let tokenReserves = await Exchange.getReserve();
                    let deployerLpToken = await Exchange.balanceOf(deployer);
                    let totalSupply = await Exchange.totalSupply();

                    expect(ethBalance).to.equal(toWei(50 + 100));
                    expect(tokenReserves).to.equal(toWei(200 + 100));
                    expect(deployerLpToken).to.equal(toWei(100 + 50));
                    expect(totalSupply).to.equal(toWei(100 + 50));
                });

                it("fails when not enough tokens", async () => {
                    await expect(
                        Exchange.addLiquidity(toWei(50), { value: toWei(50) })
                    ).to.be.revertedWithCustomError(
                        Exchange,
                        "Exchange__InvalidAmount"
                    );
                });
            });
        });

        describe("removeLiquidity", async () => {
            let tokenInit = toWei(200);
            let ethInit = toWei(100);

            beforeEach(async () => {
                // 转入200-token 100-eth的流动性
                await Token.approve(Exchange.address, toWei(300));
                await Exchange.addLiquidity(tokenInit, {
                    value: ethInit,
                });
            });

            it("removes some liquidity", async () => {
                const userEtherBalanceBefore = await getBalance(deployer);
                const userTokenBalanceBefore = await Token.balanceOf(deployer);

                await Exchange.removeLiquidity(toWei(25));
                // tokenAmount = (getReserve() * _amount) / totalSupply() = 200*25/100 = 50
                // 原来token总量 200 - 50(提出) = 150
                expect(await Exchange.getReserve()).to.equal(toWei(150));

                let ethBalance = await getBalance(Exchange.address);
                // ethAmount = (address(this).balance * _amount) / totalSupply() = 100*25/100 = 25
                // 原来eth总量 100 - 25(提出) = 75
                expect(ethBalance).to.equal(toWei(75));

                const userEtherBalanceAfter = await getBalance(deployer);
                const userTokenBalanceAfter = await Token.balanceOf(deployer);

                // 原来用户有 userEtherBalanceBefore 个 eth 移除流动性返回 25个 扣除少量的gas费
                // expect(
                //     fromWei(userEtherBalanceAfter.sub(userEtherBalanceBefore))
                // ).to.equal("24.9999025725247264"); // 25 - gas fees

                // 原来用户有 userTokenBalanceBefore 个 token 移除流动性返回 50个
                expect(
                    fromWei(userTokenBalanceAfter.sub(userTokenBalanceBefore))
                ).to.equal("50.0");
            });

            it("removes all liquidity", async () => {
                const userEtherBalanceBefore = await getBalance(deployer);
                const userTokenBalanceBefore = await Token.balanceOf(deployer);

                await Exchange.removeLiquidity(toWei(100));
                expect(await Exchange.getReserve()).to.equal(toWei(0));
                expect(await getBalance(Exchange.address)).to.equal(toWei(0));

                const userEtherBalanceAfter = await getBalance(deployer);
                const userTokenBalanceAfter = await Token.balanceOf(deployer);

                // expect(
                //     fromWei(userEtherBalanceAfter.sub(userEtherBalanceBefore))
                // ).to.equal("99.9999220574065669"); // 100 - gas fees

                expect(
                    fromWei(userTokenBalanceAfter.sub(userTokenBalanceBefore))
                ).to.equal("200.0");
            });

            it("pays for provided liquidity", async () => {
                const userEtherBalanceBefore = await getBalance(deployer);
                const userTokenBalanceBefore = await Token.balanceOf(deployer);

                // 用户1 用 eth 购买 token 得到至少 18个token
                await Exchange.connect(user).ethToTokenSwap(toWei(18), {
                    value: toWei(10),
                });
                // deployer 抽出所有流动性
                await Exchange.removeLiquidity(toWei(100));

                expect(await Exchange.getReserve()).to.equal(toWei(0));
                expect(await getBalance(Exchange.address)).to.equal(toWei(0));
                // expect(fromWei(await Token.balanceOf(user.address))).to.equal(
                //     "18.01637852593266606"
                // );

                const userEtherBalanceAfter = await getBalance(deployer);
                const userTokenBalanceAfter = await Token.balanceOf(deployer);

                // expect(
                //     fromWei(userEtherBalanceAfter.sub(userEtherBalanceBefore))
                // ).to.equal("109.999925427960331566"); // 110 - gas fees

                // expect(
                //     fromWei(userTokenBalanceAfter.sub(userTokenBalanceBefore))
                // ).to.equal("181.98362147406733394");
            });

            it("burns LP-tokens", async () => {
                await Exchange.removeLiquidity(toWei(25));
                let totalSupply = await Exchange.totalSupply();
                expect(totalSupply).to.equal(toWei(75));
            });

            it("doesn't allow invalid amount", async () => {
                await expect(
                    Exchange.removeLiquidity(toWei(100.1))
                ).to.be.revertedWithCustomError(
                    Exchange,
                    "Exchange__InvalidAmount"
                );
            });
        });
    });
}
