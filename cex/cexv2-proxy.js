const fs = require('fs');
const axios = require('axios');
const readline = require('readline');
const querystring = require('querystring');
const colors = require('colors');
const { HttpsProxyAgent } = require('https-proxy-agent');

class CexAPI {
    constructor() {
        this.headers = {
            "Accept": "*/*",
            "Accept-Encoding": "gzip, deflate, br",
            "Accept-Language": "vi-VN,vi;q=0.9,fr-FR;q=0.8,fr;q=0.7,en-US;q=0.6,en;q=0.5",
            "Content-Type": "application/json",
            "Origin": "https://cexp2.cex.io",
            "Referer": "https://cexp2.cex.io/",
            'Sec-Ch-Ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
            'Sec-Ch-Ua-Mobile': '?1',
            'Sec-Ch-Ua-Platform': '"Android"',
            'Sec-Fetch-Mode': 'cors',
            'Sec-Fetch-Site': 'same-site',
            'User-Agent': 'Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36'
        };
        this.proxies = fs.readFileSync('proxy.txt', 'utf8').split('\n').filter(Boolean);
    }

    dancay(proxy) {
        const proxyAgent = new HttpsProxyAgent(proxy);
        return axios.create({
            httpsAgent: proxyAgent,
            headers: this.headers
        });
    }

    log(msg, type = 'info') {
        const timestamp = new Date().toLocaleTimeString();
        switch(type) {
            case 'success':
                console.log(`[*] ${msg}`.green);
                break;
            case 'error':
                console.log(`[!] ${msg}`.red);
                break;
            case 'warning':
                console.log(`[*] ${msg}`.yellow);
                break;
            default:
                console.log(`[*] ${msg}`.blue);
        }
    }

    async waitWithCountdown(seconds) {
        for (let i = seconds; i >= 0; i--) {
            readline.cursorTo(process.stdout, 0);
            process.stdout.write(`[*] Chờ ${i} giây để tiếp tục...`.yellow);
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
        console.log('');
    }

    async getUserInfo(authData, Dancay) {
        const url = "https://cexp.cex.io/api/getUserInfo";
        const payload = {
            devAuthData: authData.id,
            authData: authData.authString,
            platform: "android",
            data: {}
        };

        try {
            const response = await Dancay.post(url, payload);
            return response.data;
        } catch (error) {
            throw new Error(`Error in getUserInfo: ${error.message}`);
        }
    }

    async claimCrypto(authData, Dancay) {
        const url = "https://cexp.cex.io/api/v2/claimCrypto";
        const payload = {
            devAuthData: authData.id,
            authData: authData.authString,
            platform: "android",
            data: {}
        };

        try {
            const response = await Dancay.post(url, payload);
            return response.data;
        } catch (error) {
            throw new Error(`Error in claimCrypto: ${error.message}`);
        }
    }

    async rstap(authData, Dancay) {
        const url = "https://cexp.cex.io/api/v2/claimMultiTaps";
        const payload = {
            devAuthData: authData.id,
            authData: authData.authString,
            platform: "android",
            data: {
                tapsEnergy: 1000,
                tapsToClaim: 0,
                tapsTs: Date.now()
            }
        };

        try {
            const response = await Dancay.post(url, payload);
            return response.data;
        } catch (error) {
            this.log(`Error in claimMultiTaps: ${error.message}`);
        }
    }

    async claimMultiTaps(authData, Dancay) {
        const url = "https://cexp.cex.io/api/v2/claimMultiTaps";
        
        let totalClaimed = 0;
        let userData = await this.getUserInfo(authData, Dancay);
        let remainingEnergy = userData.data.multiTapsEnergy;
    
        while (remainingEnergy > 100) {
            let tap = Math.min(100, remainingEnergy);
            
            const payload = {
                devAuthData: authData.id,
                authData: authData.authString,
                platform: "android",
                data: {
                    tapsEnergy: remainingEnergy.toString(),
                    tapsToClaim: tap.toString(),
                    tapsTs: Date.now()
                }
            };
    
            try {
                const response = await Dancay.post(url, payload);
                
                if (response.data.status !== "ok") {
                    throw new Error(`Claim failed: ${JSON.stringify(response.data)}`);
                }
    
                totalClaimed += tap;
                
                if (response.data.data && response.data.data.multiTapsEnergy !== undefined) {
                    remainingEnergy = parseInt(response.data.data.multiTapsEnergy);
                } else {
                    remainingEnergy -= tap;
                }
    
                this.log(`Đấm ${tap} phát. Năng lượng còn: ${remainingEnergy}`, 'success');
    
                await new Promise(resolve => setTimeout(resolve, 1000));
    
            } catch (error) {
                throw new Error(`Lỗi không thể tap: ${error.message}`);
            }
        }
        
        return { status: "ok", message: `Đã sử dụng hết ${totalClaimed} năng lượng!` };
    }
    
    generateRandomTaps(total, maxTap = 50) {
        let taps = [];
        let remaining = total;
        
        while (remaining > 0) {
            let maxPossibleTap = Math.min(maxTap, remaining);
            let tap = Math.floor(Math.random() * (maxPossibleTap - 1)) + 1; 
            
            taps.push(tap);
            remaining -= tap;
        }
        if (remaining > 0) {
            taps[taps.length - 1] += remaining;
        }
        
        return taps;
    }

    async getGameConfig(authData, Dancay) {
        const url = "https://cexp.cex.io/api/v2/getGameConfig";
        const payload = {
            devAuthData: authData.id,
            authData: authData.authString,
            platform: "android",
            data: {}
        };

        try {
            const response = await Dancay.post(url, payload);
            return response.data;
        } catch (error) {
            throw new Error(`Error in getGameConfig: ${error.message}`);
        }
    }

    async getUserCards(authData, Dancay) {
        const url = "https://cexp.cex.io/api/v2/getUserCards";
        const payload = {
            devAuthData: authData.id,
            authData: authData.authString,
            platform: "android",
            data: {}
        };

        try {
            const response = await Dancay.post(url, payload);
            return response.data;
        } catch (error) {
            throw new Error(`Error in getUserCards: ${error.message}`);
        }
    }

    async buyUpgrade(authData, upgradeData, Dancay) {
        const url = "https://cexp.cex.io/api/v2/buyUpgrade";
        const payload = {
            devAuthData: authData.id,
            authData: authData.authString,
            platform: "android",
            data: upgradeData
        };

        try {
            const response = await Dancay.post(url, payload);
            return response.data;
        } catch (error) {
            throw new Error(`Lỗi khi Nâng cấp: ${error.message}`);
        }
    }

    async processUpgrades(authData, Dancay, balanceUSD) {
        try {
            const gameConfig = await this.getGameConfig(authData, Dancay);
            const userCards = await this.getUserCards(authData, Dancay);
    
            if (!gameConfig.upgradeCardsConfig || !userCards.cards) {
                throw new Error("Dữ liệu không hợp lệ");
            }
    
            for (const category of gameConfig.upgradeCardsConfig) {
                for (const upgrade of category.upgrades) {
                    const userCard = userCards.cards[upgrade.upgradeId];
                    const currentLevel = userCard ? userCard.lvl : 0;
    
                    if (upgrade.dependency) {
                        const dependencyCard = userCards.cards[upgrade.dependency.upgradeId];
                        if (dependencyCard && Object.keys(dependencyCard).length > 0 && dependencyCard.lvl < upgrade.dependency.level) {
                            this.log(`Bỏ qua thẻ ${upgrade.upgradeName} : chưa đủ điều kiện nâng cấp`, 'warning');
                            continue;
                        }
                    }
    
                    if (currentLevel < upgrade.levels.length) {
                        const nextLevel = currentLevel + 1;
                        const [cost, ccy, effect, effectCcy] = upgrade.levels[currentLevel];
    
                        if (ccy === "USD" && balanceUSD < cost) {
                            this.log(`Bỏ qua thẻ ${upgrade.upgradeName}: không đủ USD (cần ${cost} USD, có ${balanceUSD} USD)`, 'warning');
                            continue;
                        }
    
                        const upgradeData = {
                            categoryId: category.categoryId,
                            upgradeId: upgrade.upgradeId,
                            nextLevel: nextLevel,
                            cost: cost,
                            ccy: ccy,
                            effect: effect,
                            effectCcy: effectCcy
                        };
    
                        try {
                            const result = await this.buyUpgrade(authData, upgradeData, Dancay);
                            if (result.status === "ok") {
                                this.log(`Nâng cấp thành công thẻ ${upgrade.upgradeName} lên level ${nextLevel}`, 'success');
                                balanceUSD -= cost;
                            } else {
                                this.log(`Nâng cấp không thành công thẻ ${upgrade.upgradeName}: ${result.message}`, 'error');
                            }
                        } catch (error) {
                        }
                        await new Promise(resolve => setTimeout(resolve, 1000));
                    }
                }
            }
        } catch (error) {
            this.log(`Error processing upgrades: ${error.message}`, 'error');
        }
    }    

    askQuestion(query) {
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout,
        });
        return new Promise(resolve => rl.question(query, ans => {
            rl.close();
            resolve(ans);
        }))
    }

    async checkProxyIP(proxy) {
        let attempts = 0;
        const maxAttempts = 1;
        const Dancay = this.dancay(proxy);
        while (attempts < maxAttempts) {
            try {
                const response = await Dancay.get('https://api.ipify.org?format=json');
                if (response.status === 200) {
                    return response.data.ip;
                } else {
                    this.log(`Không thể kiểm tra IP của proxy. Status code: ${response.status}`);
                }
            } catch (error) {
                attempts++;
                this.log(`Error khi kiểm tra IP của proxy (Lần thử ${attempts}/${maxAttempts}): ${error.message}`.red);
                if (attempts < maxAttempts) {
                    await this.sleep(2000);
                } else {
                    this.log(`Error khi kiểm tra IP của proxy sau ${maxAttempts} lần thử: ${error.message}`);
                    break;
                }
            }
        }
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    async getConvertData(authData, Dancay) {
        const url = "https://cexp.cex.io/api/v2/getConvertData";
        const payload = {
            devAuthData: authData.id,
            authData: authData.authString,
            platform: "android",
            data: {}
        };

        try {
            const response = await Dancay.post(url, payload);
            if (response.data.status === "ok" && response.data.convertData.lastPrices) {
                const lastPrice = response.data.convertData.lastPrices[response.data.convertData.lastPrices.length - 1];
                return lastPrice;
            } else {
                throw new Error("Không thể lấy được giá cuối cùng");
            }
        } catch (error) {
            throw new Error(`Error in getConvertData: ${error.message}`);
        }
    }

    async convertCrypto(authData, Dancay, userData) {
        const url = "https://cexp.cex.io/api/v2/convert";
        const lastPrice = await this.getConvertData(authData, Dancay);
        const fromAmount = (userData.balance_BTC / 100000).toFixed(5);

        const payload = {
            devAuthData: authData.id,
            authData: authData.authString,
            platform: "android",
            data: {
                fromCcy: "BTC",
                toCcy: "USD",
                fromAmount: fromAmount,
                price: lastPrice
            }
        };

        try {
            const response = await Dancay.post(url, payload);
            if (response.data.status === "ok") {
                const newBalanceUSD = response.data.convert.balance_USD;
                this.log(`Swap Crypto sang USD thành công | Balance USD: ${newBalanceUSD}`, 'success');
                return newBalanceUSD;
            } else {
                throw new Error("Chuyển đổi không thành công");
            }
        } catch (error) {
            throw new Error(`Error in convertCrypto: ${error.message}`);
        }
    }

    async askSwapPercentage() {
        const percentage = await this.askQuestion('Bạn muốn swap bao nhiêu % balance_BTC sang USD? (0-100): ');
        const parsedPercentage = parseFloat(percentage);
        if (isNaN(parsedPercentage) || parsedPercentage < 0 || parsedPercentage > 100) {
            this.log('Giá trị không hợp lệ. Vui lòng nhập số từ 0 đến 100.', 'error');
            return await this.askSwapPercentage();
        }
        return parsedPercentage;
    }

    async main() {
        const dataFile = 'data.txt';
        const data = fs.readFileSync(dataFile, 'utf8')
            .replace(/\r/g, '')
            .split('\n')
            .filter(Boolean)
            .map(line => {
                const parsed = querystring.parse(line);
                const user = JSON.parse(decodeURIComponent(parsed.user));
                return {
                    id: user.id,
                    authString: line
                };
            });
        
        this.log('Tool được chia sẻ tại kênh telegram Dân Cày Airdrop (@dancayairdrop)'.green);
        
        const buyCards = await this.askQuestion('Bạn có muốn mua và nâng cấp thẻ không? (y/n): ');
        const buyCardsDecision = buyCards.toLowerCase() === 'y';

        const swap = await this.askQuestion('Bạn có muốn swap Crypto sang USD không? (y/n): ');
        const hoiswap = swap.toLowerCase() === 'y';
        let swapPercentage = 0;
        if (hoiswap) {
            swapPercentage = await this.askSwapPercentage();
        }     

        while (true) {
            for (let i = 0; i < data.length; i++) {
                try {
                    const proxy = this.proxies[i % this.proxies.length];
                    const Dancay = this.dancay(proxy);

                    let proxyIP = 'Unknown';
                    try {
                        proxyIP = await this.checkProxyIP(proxy);
                    } catch (error) {
                        this.log(`Không thể kiểm tra IP của proxy: ${error.message}`.red);
                    }

                    const result = await this.getUserInfo(data[i], Dancay);
                    if (result.status === "ok") {
                        const userData = result.data;
                        console.log(`========== Tài khoản ${i + 1} | ${userData.first_name.green} | ip: ${proxyIP} ==========`);
                        const claimCryptoResult = await this.claimCrypto(data[i], Dancay);
                        if (claimCryptoResult.status === "ok") {
                            this.log(`Nhận Crypto thành công!`, 'success');
                        } else {
                            this.log(`Nhận Crypto không thành công!`, 'error');
                        }
    
                        this.log(`Balance BTC: ${userData.balance_BTC/100000}`, 'success');
                        this.log(`Balance USD: ${userData.balance_USD}`, 'success');
                        this.log(`Balance CEXP: ${userData.balance_CEXP}`, 'success');
                        this.log(`Năng lượng: ${userData.multiTapsEnergy} / ${userData.multiTapsEnergyLimit}`, 'info');

                        if (hoiswap) {
                            if (userData.balance_BTC > 0 && swapPercentage > 0) {
                                try {
                                    const btcToConvert = (userData.balance_BTC * (swapPercentage / 100)).toFixed(5);
                                    const newBalanceUSD = await this.convertCrypto(data[i], Dancay, userData, btcToConvert);
                                    userData.balance_USD = newBalanceUSD;
                                    this.log(`Balance USD mới sau khi swap: ${newBalanceUSD}`, 'success');
                                } catch (error) {
                                    this.log(`Không thể chuyển đổi crypto: ${error.message}`, 'error');
                                }
                            } else {
                                this.log(`Không đủ BTC để swap hoặc tỷ lệ phần trăm không hợp lệ.`, 'warning');
                            }
                        }

                        if (userData.multiTapsEnergy > 100) {
                            try {
                                const claimMultiTapsResult = await this.claimMultiTaps(data[i], Dancay);
                                this.log(claimMultiTapsResult.message, 'success');

                                const finalUserInfo = await this.getUserInfo(data[i], Dancay);
                                this.log(`Balance USD: ${finalUserInfo.data.balance_USD}`, 'success');
                            } catch (error) {
                                this.log(`Không thể tap: ${error.message}`, 'error');
                            }
                        } else {
                            this.log(`Không đủ năng lượng, cần hồi phục trên 100 để tap`, 'warning');
                        }

                        if (buyCardsDecision) {
                            await this.processUpgrades(data[i], Dancay, userData.balance_USD);
                        }

                    } else {
                        this.log(`Lỗi đọc tài khoản ${i + 1}: ${JSON.stringify(result)}`, 'error');
                    }
                } catch (error) {
                    this.log(`Lỗi xử lý tài khoản ${i + 1}: ${error.message}`, 'error');
                }
            }
    
            await this.waitWithCountdown(900);
        }
    }
}

if (require.main === module) {
    const api = new CexAPI();
    api.main().catch(err => {
        console.error(err);
        process.exit(1);
    });
}