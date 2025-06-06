export interface IBetResult {
    chip: string;
    betAmount: number;
    winAmount: number;
    mult: number;
    status: 'win' | 'loss';
};

export interface ILobbyData {
    lobbyId: number;
    start_delay: number;
    end_delay: number;
    result: {};
    time?: Date;
};

export interface IRawUserData {
    user_id: string;
    operatorId: string;
    balance: number;
    [key: string]: any;
};

export interface IFinalUserData extends IRawUserData {
    userId: string;
    id: string;
    game_id: string;
    token: string;
    image: number;
};

export interface IUserBet {
    betAmount: number;
    chip: number;
}

export interface IBetData {
    bet_id: string;
    totalBetAmount: number;
    userBets: IUserBet[];
};

export interface ISingleBetData {
    betAmount: number;
    chip: number;
};

export interface IBetObject {
    bet_id: string;
    user_id: string;
    token: string;
    socket_id: string;
    game_id: string;
    bet_amount?: number;
    userBets?: ISingleBetData[];
    lobby_id?: number;
    txn_id?: string;
    ip?: string
};

export interface ISettlementDbObject {
    lobby_id: string
    user_id: string
    operator_id: string
    bet_amount: number
    win_amount: number
    user_bets: IBetResult[]
    win_pos: number
    color: 'red' | 'black' | 'white' | ""
}

export type TLogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal';

export interface ILogEntry {
    time: number;
    level: TLogLevel;
    name: string;
    msg: string;
};

export interface IDBConfig {
    host: string;
    user: string;
    password: string;
    database: string;
    port: string;
    retries: string;
    interval: string;
};

export interface IRedisConfig {
    host: string;
    port: number;
    retry: number;
    interval: number;
};

export interface IAppConfig {
    minBetAmount: number;
    maxBetAmount: number;
    maxCashoutAmount: number;
    dbConfig: IDBConfig;
    redis: IRedisConfig;
};

export type TWebhookKey = 'CREDIT' | 'DEBIT';


export interface IPlayerDetails {
    game_id: string;
    operatorId: string;
    token: string
};

export interface IBetsData {
    id: string;
    bet_amount: number;
    winning_amount?: number;
    game_id?: string;
    user_id: string;
    bet_id?: string;
    txn_id?: string;
    ip?: string;
};

export interface IAccountsResult {
    txn_id?: string;
    status: boolean;
    type: TWebhookKey
};

export interface IWebhookData {
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

export interface IReqData {
    chip: string;
    btAmt: number;
}