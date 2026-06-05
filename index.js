const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const axios = require('axios');
const http = require('http');

// Sunucunun uyumaması için basit bir web server kuruyoruz (Uptimerobot için)
const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Bot Aktif!\n');
});
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server ${PORT} portunda dinleniyor...`));

const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: { 
        args: ['--no-sandbox', '--disable-setuid-sandbox'] 
    }
});

// QR Kod üretimi
client.on('qr', (qr) => {
    console.log('--- QR KODU TARATIN ---');
    qrcode.generate(qr, { small: true });
});

client.on('ready', () => {
    console.log('Bot başarıyla WhatsApp\'a bağlandı!');
});

// Spam koruması için hafıza
const messageLog = {};

client.on('message', async (msg) => {
    const chat = await msg.getChat();
    if (!chat.isGroup) return; // Sadece gruplarda çalışır

    const userId = msg.from;
    const now = Date.now();

    // 1) SPAM ENGELLEME
    if (!messageLog[userId]) messageLog[userId] = [];
    messageLog[userId].push(now);
    messageLog[userId] = messageLog[userId].filter(time => now - time < 5000); // Son 5 saniye

    if (messageLog[userId].length > 5) {
        msg.reply('🚨 *SPAM TESPİT EDİLDİ!* 10 dakika uzaklaştırılıyorsun.');
        try {
            await chat.removeParticipants([userId]); // Spam yapanı gruptan atar
            
            // 10 Dakika sonra geri ekleme
            setTimeout(async () => {
                try {
                    await chat.addParticipants([userId]);
                    await chat.sendMessage(`@${userId.split('@')[0]} süren bitti, gruba geri alındın. Lütfen tekrar spam yapma!`, { mentions: [userId] });
                } catch (e) {
                    await chat.sendMessage('Kişi otomatik geri eklenemedi. Lütfen yönetici manuel eklesin.');
                }
            }, 600000); // 10 dakika = 600000 milisaniye
        } catch (err) {
            await chat.sendMessage('Yönetici yetkim olmadığı için spamcıyı gruptan atamadım! Beni admin yapın.');
        }
        return;
    }

    // KOMUTLAR
    const text = msg.body.toLowerCase();

    // GÜNCEL BİLGİ KOMUTLARI
    if (text === '.saat') {
        const zaman = new Date().toLocaleTimeString('tr-TR', { timeZone: 'Europe/Istanbul' });
        msg.reply(`⏰ Şu anda saat: *${zaman}*`);
    }

    if (text === '.tarih') {
        const gun = new Date().toLocaleDateString('tr-TR', { timeZone: 'Europe/Istanbul' });
        msg.reply(`📅 Bugünün tarihi: *${gun}*`);
    }

    // RASTGELE MEDYA KOMUTLARI
    if (text === '.rastgelefoto') {
        try {
            const response = await axios.get('https://api.thecatapi.com/v1/images/search');
            const imgUrl = response.data[0].url;
            const media = await MessageMedia.fromUrl(imgUrl);
            await chat.sendMessage(media, { caption: 'Al bakalım rastgele bir kedi fotoğrafı! 📸' });
        } catch (error) {
            msg.reply('Fotoğraf getirilirken bir hata oluştu.');
        }
    }

    if (text === '.rastgelesöz') {
        const sozler = [
            "Gülmek bir güneştir, insanın yüzünden hüznü kışını defeder.",
            "Dostlar kurbağa gibidir, kaç kişinin arkandan vırakladığı önemli değil, yanındaki önemlidir. 😂",
            "Hayat kısa, kuralları çiğne, hızlı affet, yavaş öp, gerçek sev."
        ];
        const rastgele = sozler[Math.floor(Math.random() * sozler.length)];
        msg.reply(`💬 *Günün Sözü:* ${rastgele}`);
    }
});

client.initialize();
