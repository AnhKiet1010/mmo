const axios = require('axios');
const colors = require('colors');
const fs = require('fs');
const path = require('path');
const { performance } = require('perf_hooks');
const { DateTime, Duration } = require('luxon');
const readline = require('readline');

class BananaBot {
    constructor() {
        this.base_url = 'https://interface.carv.io/banana';
        this.headers = {
            'Content-Type': 'application/json',
            'Accept': 'application/json, text/plain, */*',
            'Accept-Encoding': 'gzip, deflate, br',
            'Accept-Language': 'en-US,en;q=0.9',
            'Origin': 'https://banana.carv.io',
            'Referer': 'https://banana.carv.io/',
            'Sec-CH-UA': '"Not A;Brand";v="99", "Android";v="12"',
            'Sec-CH-UA-Mobile': '?1',
            'Sec-CH-UA-Platform': '"Android"',
            'Sec-Fetch-Dest': 'empty',
            'Sec-Fetch-Mode': 'cors',
            'Sec-Fetch-Site': 'same-site',
            'User-Agent': 'Mozilla/5.0 (Linux; Android 12; Pixel 4 XL) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/99.0.4844.73 Mobile Safari/537.36',
            'X-App-ID': 'carv',
        };        
    }

    log(msg) {
        console.log(`[*] ${msg}`);
    }

    async login(queryId) {
        const loginPayload = {
            tgInfo: queryId,
            InviteCode: ""
        };

        try {
            const response = await axios.post(`${this.base_url}/login`, loginPayload, { headers: this.headers });
            await this.sleep(1000);

            const responseData = response.data;
            if (responseData.data && responseData.data.token) {
                return responseData.data.token;
            } else {
                this.log('Không tìm thấy token.');
                return null;
            }
        } catch (error) {
            this.log('Lỗi trong quá trình đăng nhập: ' + error.message);
            return null;
        }
    }

    async achieveQuest(questId) {
        const achievePayload = { quest_id: questId };
        try {
            return await axios.post(`${this.base_url}/achieve_quest`, achievePayload, { headers: this.headers });
        } catch (error) {
            this.log('Lỗi khi làm nhiệm vụ: ' + error.message);
        }
    }

    async claimQuest(questId) {
        const claimPayload = { quest_id: questId };
        try {
            return await axios.post(`${this.base_url}/claim_quest`, claimPayload, { headers: this.headers });
        } catch (error) {
            this.log('Lỗi khi claim nhiệm vụ: ' + error.message);
        }
    }

    async doClick(clickCount) {
        const clickPayload = { clickCount: clickCount };
        try {
            return await axios.post(`${this.base_url}/do_click`, clickPayload, { headers: this.headers });
        } catch (error) {
            this.log('Lỗi khi tap: ' + error.message);
        }
    }

    async getLotteryInfo() {
        try {
            return await axios.get(`${this.base_url}/get_lottery_info`, { headers: this.headers });
        } catch (error) {
            this.log('Lỗi khi lấy thông tin: ' + error.message);
        }
    }

    async claimLottery() {
        const claimPayload = { claimLotteryType: 1 };
        try {
            return await axios.post(`${this.base_url}/claim_lottery`, claimPayload, { headers: this.headers });
        } catch (error) {
            this.log('Lỗi không thể harvest: ' + error.message);
        }
    }

    async doLottery() {
        try {
            return await axios.post(`${this.base_url}/do_lottery`, {}, { headers: this.headers });
        } catch (error) {
            this.log('Lỗi khi claim tap: ' + error.message);
        }
    }

    calculateRemainingTime(lotteryData) {
        const lastCountdownStartTime = lotteryData.last_countdown_start_time || 0;
        const countdownInterval = lotteryData.countdown_interval || 0;
        const countdownEnd = lotteryData.countdown_end || false;

        if (!countdownEnd) {
            const currentTime = DateTime.now();
            const lastCountdownStart = DateTime.fromMillis(lastCountdownStartTime);
            const elapsedTime = currentTime.diff(lastCountdownStart, 'minutes').as('minutes');
            const remainingTimeMinutes = Math.max(countdownInterval - elapsedTime, 0); 
            return remainingTimeMinutes;
        }
        return 0;
    }

    askUserChoice(prompt) {
        const readline = require('readline');
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });

        return new Promise((resolve) => {
            rl.question(prompt, (answer) => {
                rl.close();
                resolve(answer.trim().toLowerCase() === 'yes');
            });
        });
    }

    async equipBestBanana(currentEquipBananaId) {
        try {
            const response = await axios.get(`${this.base_url}/get_banana_list`, { headers: this.headers });
            const bananas = response.data.data.banana_list;
    
            const eligibleBananas = bananas.filter(banana => banana.count >= 1);
            if (eligibleBananas.length > 0) {
                const bestBanana = eligibleBananas.reduce((prev, current) => {
                    return (prev.daily_peel_limit > current.daily_peel_limit) ? prev : current;
                });
    
                if (bestBanana.banana_id === currentEquipBananaId) {
                    this.log(colors.green(`Đang sử dụng quả chuối tốt nhất: ${colors.yellow(bestBanana.name)} | Price : ${colors.yellow(bestBanana.sell_exchange_peel)} Peels / ${colors.yellow(bestBanana.sell_exchange_usdt)} USDT.`));
                    return;
                }
    
                const equipPayload = { bananaId: bestBanana.banana_id };
                const equipResponse = await axios.post(`${this.base_url}/do_equip`, equipPayload, { headers: this.headers });
                if (equipResponse.data.code === 0) {
                    this.log(colors.green(`Đã Equip quả chuối tốt nhất: ${colors.yellow(bestBanana.name)} với ${bestBanana.daily_peel_limit} 🍌/ DAY`));
                } else {
                    this.log(colors.red('Sử dụng chuối thất bại!'));
                }
            } else {
                this.log(colors.red('Không có quả chuối nào được tìm thấy !'));
            }
        } catch (error) {
            this.log('Lỗi rồi: ' + error.message);
        }
    }
    

    async processAccount(queryId, isFirstAccount = false) {
        let remainingTimeMinutes = Infinity;
        const token = await this.login(queryId);
        if (token) {
            this.headers['Authorization'] = token;
            this.headers['Cache-Control'] = 'no-cache';
            this.headers['Pragma'] = 'no-cache';
    
            try {
                const userInfoResponse = await axios.get(`${this.base_url}/get_user_info`, { headers: this.headers });
                this.log(colors.green('Đăng nhập thành công !'));
                await this.sleep(1000);
                const userInfoData = userInfoResponse.data;
    
                const userInfo = userInfoData.data || {};
                const peel = userInfo.peel || 'N/A';
                const usdt = userInfo.usdt || 'N/A';
                const todayClickCount = userInfo.today_click_count || 0;
                const maxClickCount = userInfo.max_click_count || 0;
                const currentEquipBananaId = userInfo.equip_banana_id || 0;
    
                this.log(colors.green(`Balance : ${colors.white(peel)}`));
                this.log(colors.green(`USDT : ${colors.white(usdt)}`));
                this.log(colors.green(`Hôm nay đã tap : ${colors.white(todayClickCount)} lần`));
    
                await this.equipBestBanana(currentEquipBananaId);

                try {
                    const lotteryInfoResponse = await this.getLotteryInfo();
                    await this.sleep(1000);
                    const lotteryInfoData = lotteryInfoResponse.data;
    
                    remainingTimeMinutes = this.calculateRemainingTime(lotteryInfoData.data || {});
    
                    if (remainingTimeMinutes <= 0) {
                        this.log(colors.yellow('Bắt đầu claim...'));
                        await this.claimLottery();
                        
                        const updatedLotteryInfoResponse = await this.getLotteryInfo();
                        await this.sleep(1000);
                        const updatedLotteryInfoData = updatedLotteryInfoResponse.data;
                        remainingTimeMinutes = this.calculateRemainingTime(updatedLotteryInfoData.data || {});
                    }
    
                    const remainingDuration = Duration.fromMillis(remainingTimeMinutes * 60 * 1000);
                    const remainingHours = Math.floor(remainingDuration.as('hours'));
                    const remainingMinutes = Math.floor(remainingDuration.as('minutes')) % 60;
                    const remainingSeconds = Math.floor(remainingDuration.as('seconds')) % 60;
    
                    this.log(colors.yellow(`Thời gian còn lại để nhận Banana: ${remainingHours} Giờ ${remainingMinutes} phút ${remainingSeconds} giây`));
    
                    const remainLotteryCount = (lotteryInfoData.data || {}).remain_lottery_count || 0;
                    this.log(colors.yellow(`Harvest Có Sẵn : ${colors.white(remainLotteryCount)}`));
                    if (remainLotteryCount > 0) {
                        this.log('Harvest...');
                        const doLotteryResponse = await this.doLottery();
    
                        if (doLotteryResponse.status === 200) {
                            const lotteryResult = doLotteryResponse.data.data || {};
                            const bananaName = lotteryResult.name || 'N/A';
                            const sellExchangePeel = lotteryResult.sell_exchange_peel || 'N/A';
                            const sellExchangeUsdt = lotteryResult.sell_exchange_usdt || 'N/A';
    
                            this.log(`Harvest thành công ${bananaName}`);
                            console.log(colors.yellow(`     - Banana Name : ${bananaName}`));
                            console.log(colors.yellow(`     - Peel Limit : ${lotteryResult.daily_peel_limit || 'N/A'}`));
                            console.log(colors.yellow(`     - Price : ${sellExchangePeel} Peel, ${sellExchangeUsdt} USDT`));
                            await this.sleep(1000);
                        } else {
                            this.log(colors.red('Lỗi không mong muốn.'));
                        }
                    }
                } catch (error) {
                    this.log('Không lấy được lottery info: ' + error.message);
                }
    
                if (todayClickCount < maxClickCount) {
                    const clickCount = maxClickCount - todayClickCount;
                    if (clickCount > 0) {
                        this.log(colors.magenta(`Đã tap ${clickCount} lần...`));
                        await this.doClick(clickCount);
                        await this.sleep(1000);
                    } else {
                        console.log(colors.red('Không thể tap, đã đạt giới hạn tối đa!'));
                    }
                }
    
                try {
                    const questListResponse = await axios.get(`${this.base_url}/get_quest_list`, { headers: this.headers });
                    await this.sleep(1000);
                    const questListData = questListResponse.data;
    
                    const questList = (questListData.data || {}).quest_list || [];
                    for (let i = 0; i < questList.length; i++) {
                        const quest = questList[i];
                        const questName = quest.quest_name || 'N/A';
                        let isAchieved = quest.is_achieved || false;
                        let isClaimed = quest.is_claimed || false;
                        const questId = quest.quest_id;
    
                        if (!isAchieved) {
                            await this.achieveQuest(questId);
                            await this.sleep(1000);
    
                            const updatedQuestListResponse = await axios.get(`${this.base_url}/get_quest_list`, { headers: this.headers });
                            const updatedQuestListData = updatedQuestListResponse.data;
                            const updatedQuest = updatedQuestListData.data.quest_list.find(q => q.quest_id === questId);
                            isAchieved = updatedQuest.is_achieved || false;
                        }
    
                        if (isAchieved && !isClaimed) {
                            await this.claimQuest(questId);
                            await this.sleep(1000);
    
                            const updatedQuestListResponse = await axios.get(`${this.base_url}/get_quest_list`, { headers: this.headers });
                            const updatedQuestListData = updatedQuestListResponse.data;
                            const updatedQuest = updatedQuestListData.data.quest_list.find(q => q.quest_id === questId);
                            isClaimed = updatedQuest.is_claimed || false;
                        }
    
                        const achievedStatus = isAchieved ? 'Hoàn thành' : 'Thất bại';
                        const claimedStatus = isClaimed ? 'Đã Claim' : 'Chưa Claim';
    
                        const questNameColor = colors.cyan;
                        const achievedColor = isAchieved ? colors.green : colors.red;
                        const claimedColor = isClaimed ? colors.green : colors.red;
    
                        if (!questName.toLowerCase().includes('bind')) {
                            this.log(`${colors.white(`Làm nhiệm vụ `)}${questNameColor(questName)} ${colors.blue('...')}Trạng thái : ${achievedColor(achievedStatus)} | ${claimedColor(claimedStatus)}`);
                        }
                    }
    
                    const progress = questListData.data.progress || '';
                    const isClaimedQuestLottery = questListData.data.is_claimed || false;
    
                    if (isClaimedQuestLottery) {
                        this.log(colors.yellow(`Claim quest có sẵn: ${progress}`));
                        const claimQuestLotteryResponse = await axios.post(`${this.base_url}/claim_quest_lottery`, {}, { headers: this.headers });
                        if (claimQuestLotteryResponse.data.code === 0) {
                            this.log(colors.green('Claim quest thành công!'));
                        } else {
                            this.log(colors.red('Claim quest thất bại!'));
                        }
                    }
    
                } catch (error) {
                    this.log(colors.red('Lỗi khi lấy danh sách nhiệm vụ: ' + error.message));
                }
    
            } catch (error) {
                this.log('Không thể tìm nạp thông tin người dùng và danh sách nhiệm vụ do thiếu mã thông báo.');
            }
    
            if (isFirstAccount) {
                return remainingTimeMinutes;
            }
        }
        return null;
    }    

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    extractUserData(queryId) {
        const urlParams = new URLSearchParams(queryId);
        const user = JSON.parse(decodeURIComponent(urlParams.get('user')));
        return {
            auth_date: urlParams.get('auth_date'),
            hash: urlParams.get('hash'),
            query_id: urlParams.get('query_id'),
            user: user
        };
    }

    async Countdown(seconds) {
        for (let i = Math.floor(seconds); i >= 0; i--) {
            readline.cursorTo(process.stdout, 0);
            process.stdout.write(`===== Đã hoàn thành tất cả tài khoản, chờ ${i} giây để tiếp tục vòng lặp =====`);
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
        console.log('');
    }    

    async main() {
        const dataFile = path.join(__dirname, 'data.txt');
        const userData = fs.readFileSync(dataFile, 'utf8')
            .replace(/\r/g, '')
            .split('\n')
            .filter(Boolean);
    
        while (true) {
            let minRemainingTime = Infinity;
    
            for (let i = 0; i < userData.length; i++) {
                const queryId = userData[i];
                const data = this.extractUserData(queryId);
                const userDetail = data.user;
                if (queryId) {
                    console.log(`\n========== Tài khoản ${i + 1} | ${userDetail.first_name} ==========`);
                    const remainingTime = await this.processAccount(queryId, i === 0);
    
                    if (i === 0 && remainingTime !== null) {
                        minRemainingTime = remainingTime;
                    }
                    await this.sleep(5000); 
                }
            }
    
            if (minRemainingTime < Infinity) {
                const remainingDuration = Duration.fromMillis(minRemainingTime * 60 * 1000);
                const remainingSeconds = remainingDuration.as('seconds');
                await this.Countdown(remainingSeconds); 
            } else {
                await this.Countdown(10 * 60);
            }
        }
    }
}    

const bot = new BananaBot();
bot.main();
