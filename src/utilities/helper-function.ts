import { BetResult } from '../interfaces';
import { appConfig } from './app-config';
import { createLogger } from './logger';
import { Socket } from 'socket.io';

const failedBetLogger = createLogger('failedBets', 'jsonl');

export const logEventAndEmitResponse = (
    socket: Socket,
    req: any,
    res: string,
    event: string
): void => {
    const logData = JSON.stringify({ req, res });
    if (event === 'bet') {
        failedBetLogger.error(logData);
    }
    socket.emit('betError', { message: res, status: false });
};


export const getUserIP = (socket: any): string => {
    const forwardedFor = socket.handshake.headers?.['x-forwarded-for'];
    if (forwardedFor) {
        const ip = forwardedFor.split(',')[0].trim();
        if (ip) return ip;
    }
    return socket.handshake.address || '';
};


export const getBetResult = (betAmount: number, chip: number, result: number): BetResult => {
    const resultData: BetResult = {
        chip,
        betAmount,
        winAmount: 0,
        mult: 1.98,
        status: 'loss'
    };

    if (chip == result) {
        resultData.status = 'win';
        resultData.winAmount = Math.min(betAmount * resultData.mult, appConfig.maxCashoutAmount);
    }

    return resultData;
};