import { ICommandContext } from 'wolf.js';
import { Player, SpyGameState } from './types';
import { words } from './words';
import fs from 'fs';
import path from 'path';

const POINTS_FILE = path.join(__dirname, 'points.csv');

export class SpyGameManager {
    private games: Map<number, SpyGameState> = new Map();
    
    constructor() {
        if (!fs.existsSync(POINTS_FILE)) {
            fs.writeFileSync(POINTS_FILE, 'membership,points\n');
        }
    }

    createGame(ctx: ICommandContext) {
        const groupId = ctx.groupId;
        if (this.games.has(groupId)) {
            return ctx.reply('⚠️ هناك لعبة نشطة بالفعل في هذه المجموعة!');
        }

        const gameState: SpyGameState = {
            creatorId: ctx.userId,
            players: new Map(),
            started: false,
            spyPlayerId: null,
            currentWord: '',
            votes: new Map()
        };

        gameState.players.set(ctx.userId, {
            id: ctx.userId,
            nickname: ctx.nickname,
            membership: ctx.membership,
            points: this.getPlayerPoints(ctx.membership)
        });

        this.games.set(groupId, gameState);
        ctx.reply('🎮 بدأت لعبة الجاسوس!\n' +
                  '🔹 المنشئ: ' + ctx.nickname + '\n' +
                  '📝 استخدم (!جس انضم) للانضمام');
    }

    joinGame(ctx: ICommandContext) {
        const game = this.games.get(ctx.groupId);
        if (!game) return ctx.reply('⚠️ لا توجد لعبة نشطة! استخدم (!جس انشاء) لبدء لعبة جديدة');
        if (game.started) return ctx.reply('⛔ اللعبة بدأت بالفعل، لا يمكن الانضمام الآن');
        if (game.players.has(ctx.userId)) return ctx.reply('⚠️ أنت منضم بالفعل!');

        game.players.set(ctx.userId, {
            id: ctx.userId,
            nickname: ctx.nickname,
            membership: ctx.membership,
            points: this.getPlayerPoints(ctx.membership)
        });

        ctx.reply(`✅ انضم ${ctx.nickname} للعبة! (اللاعبين: ${game.players.size})`);
    }

    startGame(ctx: ICommandContext) {
        const game = this.games.get(ctx.groupId);
        if (!game) return ctx.reply('⚠️ لا توجد لعبة نشطة!');
        if (game.creatorId !== ctx.userId) return ctx.reply('⛔ فقط منشئ اللعبة يمكنه البدء!');
        if (game.started) return ctx.reply('⛔ اللعبة بدأت بالفعل!');
        if (game.players.size < 3) return ctx.reply('⚠️ تحتاج 3 لاعبين على الأقل لبدء اللعبة!');

        game.started = true;
        const randomIndex = Math.floor(Math.random() * words.length);
        game.currentWord = words[randomIndex];

        const playersArray = Array.from(game.players.values());
        const spyIndex = Math.floor(Math.random() * playersArray.length);
        game.spyPlayerId = playersArray[spyIndex].id;

        playersArray.forEach(player => {
            const isSpy = player.id === game.spyPlayerId;
            ctx.client.messaging.sendPrivateMessage(
                player.id,
                isSpy ? '🎭 أنت الجاسوس! حاول ألا تكتشف!' : `🔍 الكلمة هي: ${game.currentWord}`
            );
        });

        this.sendPlayersList(ctx);
        ctx.reply('🎬 بدأت اللعبة! استخدموا (!جس قائمه) لرؤية اللاعبين');
    }

    sendPlayersList(ctx: ICommandContext) {
        const game = this.games.get(ctx.groupId);
        if (!game || !game.started) return;

        let list = '📋 قائمة اللاعبين:\n';
        let index = 1;
        game.players.forEach(player => {
            list += `${index++}. ${player.nickname}\n`;
        });

        ctx.reply(list + '\nاستخدم (!جس [رقم]) للتصويت مثل: (!جس 1)');
    }

    voteForSpy(ctx: ICommandContext, vote: number) {
        const game = this.games.get(ctx.groupId);
        if (!game || !game.started) return ctx.reply('⚠️ لا توجد لعبة نشطة!');

        const playersArray = Array.from(game.players.values());
        if (vote < 1 || vote > playersArray.length) {
            return ctx.reply(`⚠️ الرقم يجب أن يكون بين 1 و ${playersArray.length}`);
        }

        const votedPlayer = playersArray[vote - 1];
        game.votes.set(ctx.userId, votedPlayer.id);

        ctx.reply(`✅ تم التصويت للاعب ${votedPlayer.nickname}`);

        if (game.votes.size === game.players.size) {
            this.calculateVotes(ctx);
        }
    }

    private calculateVotes(ctx: ICommandContext) {
        const game = this.games.get(ctx.groupId);
        if (!game) return;

        const voteCounts = new Map<number, number>();
        game.votes.forEach(votedPlayerId => {
            voteCounts.set(votedPlayerId, (voteCounts.get(votedPlayerId) || 0) + 1);
        });

        let maxVotes = 0;
        let suspectedPlayerId: number | null = null;
        voteCounts.forEach((votes, playerId) => {
            if (votes > maxVotes) {
                maxVotes = votes;
                suspectedPlayerId = playerId;
            }
        });

        if (suspectedPlayerId === null) {
            ctx.reply('❌ لم يتم التصويت بشكل صحيح!');
            return;
        }

        const suspectedPlayer = game.players.get(suspectedPlayerId);
        const isSpy = suspectedPlayerId === game.spyPlayerId;

        game.players.forEach(player => {
            let pointsChange = 0;
            if (player.id === game.spyPlayerId) {
                pointsChange = isSpy ? -1 : 1;
            } else if (player.id === suspectedPlayerId) {
                pointsChange = isSpy ? 1 : -1;
            } else {
                pointsChange = isSpy ? 1 : -1;
            }
            player.points += pointsChange;
            this.updatePlayerPoints(player.membership, player.points);
        });

        const result = isSpy
            ? `🎯 تم كشف الجاسوس! ${suspectedPlayer!.nickname} كان الجاسوس!`
            : `❌ خطأ! ${suspectedPlayer!.nickname} ليس الجاسوس!\nالجاسوس الحقيقي كان: ${game.players.get(game.spyPlayerId!)!.nickname}`;

        ctx.reply(
            `${result}\nالكلمة كانت: ${game.currentWord}\n\n` +
            'استخدموا (!جس ترتيبي) لرؤية النقاط'
        );

        this.games.delete(ctx.groupId);
    }

    kickPlayer(ctx: ICommandContext, membership: string) {
        const game = this.games.get(ctx.groupId);
        if (!game) return ctx.reply('⚠️ لا توجد لعبة نشطة!');
        if (game.creatorId !== ctx.userId) return ctx.reply('⛔ فقط منشئ اللعبة يمكنه الطرد!');

        let targetPlayer: Player | null = null;
        for (const player of game.players.values()) {
            if (player.membership === membership) {
                targetPlayer = player;
                break;
            }
        }

        if (!targetPlayer) return ctx.reply('⚠️ لا يوجد لاعب بهذا الرقم!');
        game.players.delete(targetPlayer.id);
        ctx.reply(`🗑️ تم طرد ${targetPlayer.nickname} من اللعبة!`);
    }

    showLeaderboard(ctx: ICommandContext) {
        const game = this.games.get(ctx.groupId);
        if (!game) return ctx.reply('⚠️ لا توجد لعبة نشطة!');

        const pointsData = this.loadPoints();
        
        const players = Array.from(game.players.values())
            .sort((a, b) => {
                const aPoints = parseInt(pointsData[a.membership] || '0');
                const bPoints = parseInt(pointsData[b.membership] || '0');
                return bPoints - aPoints;
            });

        let leaderboard = '🏆 ترتيب النقاط:\n';
        players.forEach((player, index) => {
            const points = parseInt(pointsData[player.membership] || '0');
            leaderboard += `${index + 1}. ${player.nickname}: ${points} نقطة\n`;
        });

        ctx.reply(leaderboard);
    }

    showHelp(ctx: ICommandContext) {
        const help = `🎮 أوامر لعبة الجاسوس:
(!جس انشاء) - بدء لعبة جديدة
(!جس انضم) - الانضمام للعبة
(!جس بدء) - بدء اللعبة (للمنشئ فقط)
(!جس قائمه) - عرض قائمة اللاعبين
(!جس [رقم]) - التصويت على لاعب (مثال: !جس 1)
(!جس طرد [رقم العضوية]) - طرد لاعب (مثال: !جس طرد 12345678)
(!جس ترتيبي) - عرض النقاط
(!جس مساعده) - عرض هذه التعليمات`;

        ctx.reply(help);
    }

    private loadPoints(): Record<string, string> {
        const data: Record<string, string> = {};
        
        try {
            const content = fs.readFileSync(POINTS_FILE, 'utf-8');
            const lines = content.split('\n').slice(1);
            
            for (const line of lines) {
                if (!line.trim()) continue;
                const [membership, points] = line.split(',');
                data[membership] = points;
            }
        } catch (err) {
            console.error('خطأ في قراءة ملف النقاط:', err);
        }
        
        return data;
    }

    private updatePlayerPoints(membership: string, points: number) {
        try {
            const content = fs.readFileSync(POINTS_FILE, 'utf-8');
            const lines = content.split('\n');
            const headers = lines[0];
            let found = false;
            
            const updatedLines = lines.slice(1).map(line => {
                if (!line.trim()) return '';
                const [m, p] = line.split(',');
                if (m === membership) {
                    found = true;
                    return `${membership},${points}`;
                }
                return line;
            }).filter(line => line.trim());
            
            if (!found) {
                updatedLines.push(`${membership},${points}`);
            }
            
            fs.writeFileSync(POINTS_FILE, `${headers}\n${updatedLines.join('\n')}`);
        } catch (err) {
            console.error('خطأ في تحديث نقاط اللاعب:', err);
        }
    }

    private getPlayerPoints(membership: string): number {
        try {
            const pointsData = this.loadPoints();
            return parseInt(pointsData[membership] || '0');
        } catch (err) {
            console.error('خطأ في الحصول على نقاط اللاعب:', err);
            return 0;
        }
    }
}
