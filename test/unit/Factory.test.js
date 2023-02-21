const { assert, expect } = require("chai");
const { network, deployments, ethers } = require("hardhat");
const { developmentChains } = require("../../helper-hardhat-config");

if (!developmentChains.includes(network.name)) {
    describe.skip;
} else {
    describe("Token Unit Tests", function () {
        let deployer, Token, Factory;
        beforeEach(async () => {
            deployer = (await getNamedAccounts()).deployer;
            await deployments.fixture(["token", "factory"]);

            Token = await ethers.getContract("ERC20FixedSupply");
            Factory = await ethers.getContract("Factory");
        });

        describe("createExchange", () => {
            it("deploys an exchange", async () => {
                // createExchange不是view函数 拿不到结果 callStatic可以 
                const exchangeAddress = await Factory.callStatic.createExchange(
                    Token.address
                );
                await Factory.createExchange(Token.address);
                expect(await Factory.tokenToExchange(Token.address)).to.equal(
                    exchangeAddress
                );

                const Exchange = await ethers.getContractFactory("Exchange");
                const ExchangeToken = await Exchange.attach(exchangeAddress);

                expect(await ExchangeToken.name()).to.equal("Lp-Token");
                expect(await ExchangeToken.symbol()).to.equal("LP");
                expect(await ExchangeToken.factoryAddress()).to.equal(
                    Factory.address
                );
            });

            it("doesn't allow zero address", async () => {
                await expect(
                    Factory.createExchange(
                        "0x0000000000000000000000000000000000000000"
                    )
                ).to.be.revertedWithCustomError(
                    Factory,
                    "Factory__InvalidAddress"
                );
            });

            it("fails when exchange exists", async () => {
                let res = await Factory.tokenToExchange(Token.address);
                await Factory.createExchange(Token.address);

                await expect(
                    Factory.createExchange(Token.address)
                ).to.be.revertedWithCustomError(
                    Factory,
                    "Factory__ExchangeAlreadyExists"
                );
            });
        });

        describe("getExchange", () => {
            it("returns exchange address by token address", async () => {
                const exchangeAddress = await Factory.callStatic.createExchange(
                    Token.address
                );
                await Factory.createExchange(Token.address);
                expect(await Factory.getExchange(Token.address)).to.equal(
                    exchangeAddress
                );
            });
        });
    });
}
