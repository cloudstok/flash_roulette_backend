export type BetResult = {
    chip: number;
    betAmount: number;
    winAmount: number;
    mult: number;
    status: 'win' | 'loss';
};

export interface LobbyData {
    lobbyId: number;
    start_delay: number;
    end_delay: number;
    result: {};
    time?: Date;
};

export interface RawUserData {
    user_id: string;
    operatorId: string;
    balance: number;
    [key: string]: any;
};

export interface FinalUserData extends RawUserData {
    userId: string;
    id: string;
    game_id: string;
    token: string;
    image: number;
};

export interface UserBet {
    betAmount: number;
    chip: number;
}

export interface BetData {
    bet_id: string;
    totalBetAmount: number;
    userBets: UserBet[];
};

export interface SingleBetData {
    betAmount: number;
    chip: number;
};

export interface BetObject {
    bet_id: string;
    token: string;
    socket_id: string;
    game_id: string;
    bet_amount?: number;
    userBets?: SingleBetData[];
    lobby_id: number;
    txn_id?: string;
    ip?: string
};

export type LogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal';

export interface LogEntry {
    time: number;
    level: LogLevel;
    name: string;
    msg: string;
};

interface DBConfig {
    host: string;
    user: string;
    password: string;
    database: string;
    port: string;
    retries: string;
    interval: string;
};

interface RedisConfig {
    host: string;
    port: number;
    retry: number;
    interval: number;
};

export interface AppConfig {
    minBetAmount: number;
    maxBetAmount: number;
    maxCashoutAmount: number;
    dbConfig: DBConfig;
    redis: RedisConfig;
};

export type WebhookKey = 'CREDIT' | 'DEBIT';


export interface PlayerDetails {
    game_id: string;
    operatorId: string;
    token: string
};

export interface BetsData {
    id: number;
    bet_amount?: number | string;
    winning_amount?: number | string;
    game_id?: string;
    user_id: string;
    bet_id?: string;
    txn_id?: string;
    ip?: string;
};

export interface AccountsResult {
    txn_id?: string;
    status: boolean;
    type: WebhookKey
};

export interface WebhookData {
    txn_id: string;
    ip?: string;
    game_id: string | undefined;
    user_id: string;
    amount?: string | number;
    description?: string;
    bet_id?: string;
    txn_type?: number;
    txn_ref_id?: string;
};

export interface ReqData {
    chip: string;
    btAmt: number;
}