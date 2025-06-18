import dotenv from 'dotenv';
dotenv.config();

import { WOLF, CommandContext } from 'wolf.js';
import { SpyGameManager } from './spyGame';

if (!process.env.WOLF_USERNAME || !process.env.WOLF_PASSWORD) {
    console.error('❌ لم يتم تعيين بيانات الاعتماد في ملف .env');
    process.exit(1);
}

const client = new WOLF();
const gameManager = new SpyGameManager();

client.command.register({
    name: 'جس انشاء',
    aliases: ['جاسوس انشاء'],
    execute: (ctx: CommandContext) => gameManager.createGame(ctx)
});

client.command.register({
    name: 'جس انضم',
    aliases: ['جاسوس انضم'],
    execute: (ctx: CommandContext) => gameManager.joinGame(ctx)
});

client.command.register({
    name: 'جس بدء',
    aliases: ['جاسوس بدء'],
    execute: (ctx: CommandContext) => gameManager.startGame(ctx)
});

client.command.register({
    name: 'جس قائمه',
    aliases: ['جاسوس قائمه'],
    execute: (ctx: CommandContext) => gameManager.sendPlayersList(ctx)
});

client.command.register({
    name: 'جس طرد',
    aliases: ['جاسوس طرد'],
    execute: (ctx: CommandContext) => {
        const args = ctx.content.split(' ');
        if (args.length < 3) return ctx.reply('⚠️ استخدم: !جس طرد [رقم العضوية]');
        gameManager.kickPlayer(ctx, args[2]);
    }
});

client.command.register({
    name: 'جس ترتيبي',
    aliases: ['جاسوس ترتيبي'],
    execute: (ctx: CommandContext) => gameManager.showLeaderboard(ctx)
});

client.command.register({
    name: 'جس مساعده',
    aliases: ['جاسوس مساعده'],
    execute: (ctx: CommandContext) => gameManager.showHelp(ctx)
});

client.command.register({
    name: 'جس',
    aliases: ['جاسوس'],
    execute: (ctx: CommandContext) => {
        const args = ctx.content.split(' ');
        if (args.length < 2) return;
        
        const vote = parseInt(args[1]);
        if (!isNaN(vote)) {
            gameManager.voteForSpy(ctx, vote);
        }
    }
});

client.on('ready', () => {
    console.log(`✅ البوت جاهز: ${client.currentSubscriber.nickname}`);
    console.log('📂 يتم استخدام ملف points.csv لتخزين النقاط');
});

client.login(process.env.WOLF_USERNAME, process.env.WOLF_PASSWORD)
    .then(() => console.log('✅ تم الاتصال بالسيرفر'))
    .catch(err => {
        console.error('❌ خطأ في الاتصال:', err);
        if (err.response?.status === 401) {
            console.error('⚠️ بيانات الاعتماد غير صحيحة. تأكد من اسم المستخدم وكلمة المرور');
        }
    });
