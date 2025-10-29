const { Telegraf } = require('telegraf');
const admin = require('firebase-admin');

const botToken = process.env.BOT_TOKEN;
const serviceAccountJson = process.env.FIREBASE_PRIVATE_KEY;

if (!botToken || !serviceAccountJson) {
    console.error("Environment variables are missing!");
    module.exports = (req, res) => {
        res.status(500).send("Server configuration error.");
    };
    return;
}

try {
    if (admin.apps.length === 0) {
        const serviceAccount = JSON.parse(serviceAccountJson);
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount)
        });
    }
} catch (e) {
    console.error("Firebase Initialization Error:", e.message);
}

const db = admin.firestore();
const bot = new Telegraf(botToken);

bot.on('new_chat_members', async (ctx) => {
    try {
        for (const member of ctx.message.new_chat_members) {
            if (!member.is_bot) {
                const userId = member.id;
                const userName = member.username || member.first_name;
                const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();

                await db.collection('telegram_verifications').doc(verificationCode).set({
                    telegramUserId: userId,
                    telegramUsername: userName,
                    createdAt: admin.firestore.FieldValue.serverTimestamp(),
                    used: false
                });

                await ctx.telegram.sendMessage(
                    userId,
                    `Hello ${userName}! Welcome to the Global Earning group.\n\n` +
                    `To verify your account in the app, use this one-time code:\n\n` +
                    `Code: *${verificationCode}*\n\n` +
                    `This code is valid for 10 minutes.`,
                    { parse_mode: 'Markdown' }
                );
            }
        }
    } catch (error) {
        console.error("Error processing new member:", error);
        try {
            await ctx.reply(`Welcome! Please start a chat with me (@${ctx.botInfo.username}) to get your verification code.`);
        } catch (e) {
            console.error("Could not reply in group chat:", e);
        }
    }
});

bot.start((ctx) => ctx.reply('Hello! I am the verification bot for Global Earning. Please join the main group to get your code.'));

module.exports = async (req, res) => {
    try {
        await bot.handleUpdate(req.body);
    } catch (err) {
        console.error(err);
    }
    res.status(200).send('OK');
};
