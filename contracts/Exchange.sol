// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

error Exchange__InvalidAddress();
error Exchange__InvalidParams();
error Exchange__InsufficientOutput();
error Exchange__InvalidAmount();
error Exchange__InvalidExchange();

interface IFactory {
    function getExchange(address _tokenAddress) external returns (address);
}

interface IExchange {
    function ethToTokenSwap(uint256 _minTokens) external payable;

    function ethToTokenTransfer(
        uint256 _minTokens,
        address _recipient
    ) external payable;
}

contract Exchange is ERC20 {
    address public tokenAddress;
    address public factoryAddress;

    constructor(address _tokenAddress) ERC20("Lp-Token", "LP") {
        if (_tokenAddress == address(0)) {
            revert Exchange__InvalidAddress();
        }
        tokenAddress = _tokenAddress;
        factoryAddress = msg.sender;
    }

    function addLiquidity(uint256 _amount) public payable returns (uint256) {
        uint256 tokenReserve = getReserve();
        IERC20 token = IERC20(tokenAddress);

        // 流动池为空的时候不作限制
        if (tokenReserve == 0) {
            token.transferFrom(msg.sender, address(this), _amount);

            // 铸造LP凭证
            uint256 liquidity = address(this).balance;
            _mint(msg.sender, liquidity);
            return liquidity;
        }
        // 新增token的数量 跟 原来的池子的比例要保持一致
        else {
            uint256 ethReserve = address(this).balance - msg.value;
            uint256 tokenAmount = (msg.value * tokenReserve) / ethReserve;

            if (tokenAmount > _amount) {
                revert Exchange__InvalidAmount();
            }
            token.transferFrom(msg.sender, address(this), tokenAmount);

            // 铸造LP凭证
            uint256 liquidity = (totalSupply() * msg.value) / ethReserve;
            _mint(msg.sender, liquidity);
            return liquidity;
        }
    }

    function removeLiquidity(
        uint256 _amount
    ) public returns (uint256, uint256) {
        if (_amount <= 0) {
            revert Exchange__InvalidParams();
        }
        // 扣除的流动性不能比LP数量多
        if (balanceOf(msg.sender) < _amount) {
            revert Exchange__InvalidAmount();
        }

        // eth = 本合约的eth数量 * lp-token所占比例
        uint256 ethAmount = (address(this).balance * _amount) / totalSupply();
        // token = 本合约的token数量 * lp-token所占比例
        uint256 tokenAmount = (getReserve() * _amount) / totalSupply();

        _burn(msg.sender, _amount);
        payable(msg.sender).transfer(ethAmount);
        IERC20(tokenAddress).transfer(msg.sender, tokenAmount);

        return (ethAmount, tokenAmount);
    }

    function getReserve() public view returns (uint256) {
        return IERC20(tokenAddress).balanceOf(address(this));
    }

    function getAmount(
        uint256 inputAmount,
        uint256 inputReserve,
        uint256 outputReserve
    ) private pure returns (uint256) {
        if (inputAmount <= 0 || outputReserve <= 0) {
            revert Exchange__InvalidParams();
        }
        // 计算输出代币的数量
        // (outputReserve * inputAmount) / (inputReserve + inputAmount);
        // 扣除手续费的公式
        // outputReserve * inputAmount * 99 / (100 * inputReserve + inputAmount * 99)
        return
            (outputReserve * inputAmount * 99) /
            (100 * inputReserve + inputAmount * 99);
    }

    function getTokenAmount(uint256 _ethSold) public view returns (uint256) {
        if (_ethSold <= 0) {
            revert Exchange__InvalidParams();
        }
        uint256 tokenReserve = getReserve();
        return getAmount(_ethSold, address(this).balance, tokenReserve);
    }

    function getEthAmount(uint256 _token) public view returns (uint256) {
        if (_token <= 0) {
            revert Exchange__InvalidParams();
        }
        uint256 tokenReserve = getReserve();
        return getAmount(_token, tokenReserve, address(this).balance);
    }

    function ethToToken(uint256 _minTokens, address recipient) private {
        uint256 tokenReserve = getReserve();
        uint256 tokenBought = getAmount(
            msg.value,
            address(this).balance - msg.value,
            tokenReserve
        );
        if (tokenBought < _minTokens) {
            revert Exchange__InsufficientOutput();
        }
        IERC20(tokenAddress).transfer(recipient, tokenBought);
    }

    function ethToTokenTransfer(
        uint256 _minTokens,
        address _recipient
    ) public payable {
        ethToToken(_minTokens, _recipient);
    }

    function ethToTokenSwap(uint256 _minTokens) public payable {
        ethToToken(_minTokens, msg.sender);
    }

    function tokenToEthSwap(uint256 _tokenSold, uint256 _minEth) public {
        uint256 tokenReserve = getReserve();
        uint256 ethBought = getAmount(
            _tokenSold,
            tokenReserve,
            address(this).balance
        );
        if (ethBought < _minEth) {
            revert Exchange__InsufficientOutput();
        }

        IERC20(tokenAddress).transferFrom(
            msg.sender,
            address(this),
            _tokenSold
        );
        payable(msg.sender).transfer(ethBought);
    }

    function tokenToTokenSwap(
        uint256 _tokenSold,
        uint256 _minTokensBought,
        address _tokenAddress
    ) public {
        address exchangeAddress = IFactory(factoryAddress).getExchange(
            _tokenAddress
        );
        // exchangeAddress是目标池子的代币 不能是本合约代币
        if (exchangeAddress == address(this) || exchangeAddress == address(0)) {
            revert Exchange__InvalidExchange();
        }

        uint256 tokenReserve = getReserve();
        // 计算能获取eth的数量
        uint256 ethBought = getAmount(
            _tokenSold,
            tokenReserve,
            address(this).balance
        );
        // 将用户token发送到本合约
        IERC20(tokenAddress).transferFrom(
            msg.sender,
            address(this),
            _tokenSold
        );
        // 将获取到的eth转换成目标代币
        IExchange(exchangeAddress).ethToTokenTransfer{value: ethBought}(
            _minTokensBought,
            msg.sender
        );
    }
}
