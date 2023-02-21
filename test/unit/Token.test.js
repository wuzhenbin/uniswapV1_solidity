const { assert, expect } = require("chai");
const { network, deployments, ethers } = require("hardhat");
const { developmentChains } = require("../../helper-hardhat-config");

if (!developmentChains.includes(network.name)) {
    describe.skip;
} else {
    describe("Token Unit Tests", function () {
        let deployer, Token;
        before(async () => {
            deployer = (await getNamedAccounts()).deployer;
            await deployments.fixture(["token"]);
            Token = await ethers.getContract("ERC20FixedSupply");
        });

        it("sets name and symbol when created", async () => {
            expect(await Token.name()).to.equal("Doge");
            expect(await Token.symbol()).to.equal("Doge");
        });

        it("mints initialSupply to msg.sender when created", async () => {
            let values = ethers.utils.parseUnits("10000").toString();
            expect(await Token.totalSupply()).to.equal(values);
            expect(await Token.balanceOf(deployer)).to.equal(values);
        });
    });
}
