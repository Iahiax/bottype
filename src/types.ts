export interface Player {
    id: number;
    nickname: string;
    membership: string;
    points: number;
    isSpy?: boolean;
}

export interface SpyGameState {
    creatorId: number;
    players: Map<number, Player>;
    started: boolean;
    spyPlayerId: number | null;
    currentWord: string;
    votes: Map<number, number>;
}
