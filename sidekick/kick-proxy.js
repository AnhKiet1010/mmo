const fs = require('fs');
const path = require('path');
const axios = require('axios');
const colors = require('colors');
const readline = require('readline');
const WebSocket = require('ws');
const { HttpsProxyAgent } = require('https-proxy-agent');

class SidekickAPIClient {
    constructor() {
        this.headers = {
            "Accept": "application/json, text/plain, */*",
            "Accept-Encoding": "gzip, deflate, br",
            "Accept-Language": "vi-VN,vi;q=0.9,fr-FR;q=0.8,fr;q=0.7,en-US;q=0.6,en;q=0.5",
            "Content-Type": "application/json",
            "Origin": "https://game.sidekick.fans",
            "Referer": "https://game.sidekick.fans/",
            "Sec-Ch-Ua": '"Not/A)Brand";v="99", "Google Chrome";v="115", "Chromium";v="115"',
            "Sec-Ch-Ua-Mobile": "?0",
            "Sec-Ch-Ua-Platform": '"Windows"',
            "Sec-Fetch-Dest": "empty",
            "Sec-Fetch-Mode": "cors",
            "Sec-Fetch-Site": "same-site",
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36"
        };
        this.proxies = fs.readFileSync('proxy.txt', 'utf8').split('\n').filter(Boolean);
    }

    log(msg, type = 'info') {
        const timestamp = new Date().toLocaleTimeString();
        switch(type) {
            case 'success':
                console.log(`[${timestamp}] [*] ${msg}`.green);
                break;
            case 'custom':
                console.log(`[${timestamp}] [*] ${msg}`);
                break;        
            case 'error':
                console.log(`[${timestamp}] [!] ${msg}`.red);
                break;
            case 'warning':
                console.log(`[${timestamp}] [*] ${msg}`.yellow);
                break;
            default:
                console.log(`[${timestamp}] [*] ${msg}`.blue);
        }
    }

    async countdown(seconds) {
        for (let i = seconds; i >= 0; i--) {
            readline.cursorTo(process.stdout, 0);
            process.stdout.write(`===== Chờ ${i} giây để tiếp tục vòng lặp =====`);
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
        this.log('', 'info');
    }

    async checkProxyIP(proxy) {
        try {
            const proxyAgent = new HttpsProxyAgent(proxy);
            const response = await axios.get('https://api.ipify.org?format=json', { httpsAgent: proxyAgent });
            if (response.status === 200) {
                return response.data.ip;
            } else {
                throw new Error(`Không thể kiểm tra IP của proxy. Status code: ${response.status}`);
            }
        } catch (error) {
            throw new Error(`Error khi kiểm tra IP của proxy: ${error.message}`);
        }
    }

    async login(init, proxyAgent) {
        const url = "https://gameapi.sidekick.fans/api/user/login";
        const userData = JSON.parse(decodeURIComponent(init.split('user=')[1].split('&')[0]));
        const payload = {
            telegramId: userData.id.toString(),
            firstName: userData.first_name,
            lastName: userData.last_name || "",
            languageCode: userData.language_code,
            isVip: false,
            init: init
        };

        try {
            const response = await axios.post(url, payload, { headers: this.headers, httpsAgent: proxyAgent });
            if (response.status === 201 && response.data.success) {
                return { 
                    success: true, 
                    token: response.data.data.accessToken
                };
            } else {
                return { success: false, error: response.data.message };
            }
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    async getUserDate(token, telegramId, proxyAgent) {
        const url = `https://gameapi.sidekick.fans/api/user/${telegramId}/date`;
        const headers = { ...this.headers, "Authorization": `Bearer ${token}` };
        try {
            const response = await axios.get(url, { headers, httpsAgent: proxyAgent });
            if (response.status === 200 && response.data.success) {
                return { 
                    success: true, 
                    displayYears: response.data.data.displayYears,
                    reward: response.data.data.reward
                };
            } else {
                return { success: false, error: response.data.message };
            }
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    async connectWebSocket(token, proxyAgent) {
        return new Promise((resolve, reject) => {
            const ws = new WebSocket('wss://gameapi.sidekick.fans/socket.io/?EIO=4&transport=websocket', {
                agent: proxyAgent
            });
            
            const closeWebSocket = () => {
                if (ws.readyState === WebSocket.OPEN) {
                    ws.close();
                }
                resolve();
            };

            ws.on('open', () => {
                this.log('Kết nối thành công', 'success');
                const authMessage = `40{"token":"Bearer ${token}"}`;
                ws.send(authMessage);
                
                setTimeout(() => {
                    const taskListMessage = '425["getTaskList"]';
                    ws.send(taskListMessage);
                }, 3000);
            });

            ws.on('message', async (data) => {
                const message = data.toString();

                if (message.startsWith('40')) {
                } else if (message.startsWith('42') || message.startsWith('43')) {
                    try {
                        const jsonStr = message.replace(/^[\d]+/, '').trim();
                        const parsed = JSON.parse(jsonStr);
                        
                        if (Array.isArray(parsed) && parsed.length > 0) {
                            if (parsed[0] === true || (Array.isArray(parsed[0]) && parsed[0][0] === true)) {
                                this.log('Làm nhiệm vụ thành công!', 'success');
                            } else if (parsed[0] === "exception") {
                                this.log(`Làm nhiệm vụ không thành công: ${parsed[1].message}`, 'error');
                            } else if (Array.isArray(parsed[0]) || Array.isArray(parsed[1])) {
                                const tasks = Array.isArray(parsed[1]) ? parsed[1] : parsed[0];
                                const unfinishedTasks = tasks.filter(task => !task.isFinish);
                                this.log(`Tìm thấy ${unfinishedTasks.length} nhiệm vụ chưa làm`, 'info');
                                
                                let messageCounter = 9;
                                for (const task of unfinishedTasks) {
                                    await new Promise(resolve => setTimeout(resolve, 1000));
                                    const changeTaskMessage = `42${messageCounter}["changeTask",{"taskId":"${task._id}"}]`;
                                    ws.send(changeTaskMessage);
                                    this.log(`Làm nhiệm vụ: ${task.title}`, 'info');
                                    messageCounter++;
                                }

                                setTimeout(closeWebSocket, 3000);
                            } else {
                                this.log(`Định dạng tin nhắn không hợp lệ: ${JSON.stringify(parsed)}`, 'warning');
                            }
                        } else {
                            this.log(`Định dạng tin nhắn không hợp lệ: ${JSON.stringify(parsed)}`, 'warning');
                        }
                    } catch (error) {
                        this.log(`Lỗi xử lý tin nhắn: ${error.message}`, 'error');
                        this.log(`Lỗi xử lý tin nhắn: ${message}`, 'error');
                    }
                }
            });

            ws.on('close', () => {
                this.log('Ngắt kết nối!', 'info');
                resolve();
            });

            ws.on('error', (error) => {
                this.log(`Lỗi rồi: ${error.message}`, 'error');
                reject(error);
            });
        });
    }

    async main() {
        const dataFile = path.join(__dirname, 'data.txt');
        const data = fs.readFileSync(dataFile, 'utf8')
            .replace(/\r/g, '')
            .split('\n')
            .filter(Boolean);

        while (true) {
            for (let i = 0; i < data.length; i++) {
                const init = data[i];
                const userData = JSON.parse(decodeURIComponent(init.split('user=')[1].split('&')[0]));
                const telegramId = userData.id;
                const firstName = userData.first_name;
                const proxy = this.proxies[i];
                const proxyAgent = new HttpsProxyAgent(proxy);

                let proxyIP = "Unknown";
                try {
                    proxyIP = await this.checkProxyIP(proxy);
                } catch (error) {
                    this.log(`Không thể kiểm tra IP của proxy: ${error.message}`, 'warning');
                }

                console.log(`========== Tài khoản ${i + 1} | ${firstName.green} | ip: ${proxyIP} ==========`);
                
                const loginResult = await this.login(init, proxyAgent);
                if (loginResult.success) {
                    this.log('Đăng nhập thành công!', 'success');
                    const token = loginResult.token;
                    
                    const userDateResult = await this.getUserDate(token, telegramId, proxyAgent);
                    if (userDateResult.success) {
                        this.log(`Tuổi tài khoản: ${userDateResult.displayYears} năm`, 'info');
                        this.log(`Phần thưởng: ${userDateResult.reward}`, 'info');
                    } else {
                        this.log(`Không thể lấy thông tin user date: ${userDateResult.error}`, 'error');
                    }

                    this.log('Đọc dữ liệu nhiệm vụ...', 'info');
                    try {
                        await this.connectWebSocket(token, proxyAgent);
                    } catch (error) {
                        this.log(`Lỗi rồi: ${error.message}`, 'error');
                    }
                } else {
                    this.log(`Đăng nhập không thành công! ${loginResult.error}`, 'error');
                }

                await new Promise(resolve => setTimeout(resolve, 1000));
            }

            await this.countdown(1440 * 60);
        }
    }
}

const client = new SidekickAPIClient();
client.main().catch(err => {
    client.log(err.message, 'error');
    process.exit(1);
});