import { updateBalanceFromAccount } from '../../utilities/common-function';
import { appConfig } from '../../utilities/app-config';
import { setCache, getCache } from '../../utilities/redis-connection';
import { getUserIP, logEventAndEmitResponse } from '../../utilities/helper-function';
import { createLogger } from '../../utilities/logger';
import { Socket } from 'socket.io';
import { IBetObject, IBetResult, IPlayerDetails, IReqData } from '../../interfaces';
import { randomUUID } from 'crypto';
import { waitForDebugger } from 'inspector';
const logger = createLogger('Bets', 'jsonl');

export const placeBet = async (socket: Socket, betData: IReqData[]) => {
    try {
        const infoKey = `PL:${socket.id}`
        const playerDetails = await getCache(infoKey);
        console.log({ playerDetails, betData });
        if (!playerDetails) {
            return socket.emit('message', { eventName: 'betError', data: { message: 'Invalid Player Details', status: false } });
        }

        const parsedPlayerDetails = JSON.parse(playerDetails);
        const { userId, operatorId, token, game_id, balance } = parsedPlayerDetails;

        const { invalidBetPayload, totalBetAmount } = betDataValidator(betData);
        if (invalidBetPayload) logEventAndEmitResponse(socket, betData, "Invalid Bet Payload", "bet")

        if (totalBetAmount > appConfig.maxBetAmount || totalBetAmount < appConfig.minBetAmount) {
            return socket.emit("ERROR", "Bet amount out of range");
        }

        if (balance < totalBetAmount) {
            return socket.emit("ERROR", "Not enough balance to place this bet");
        }
        if (balance - totalBetAmount < 0) {
            return socket.emit("ERROR", "Not enough balance to place this bet");
        }

        const betId = randomUUID();
        const debitObj: IBetObject = {
            bet_id: betId,
            bet_amount: totalBetAmount,
            game_id: game_id,
            user_id: userId,
            ip: getUserIP(socket),
            token: token,
            socket_id: socket.id,
        };

        const playerDetailsForTxn: IPlayerDetails = { game_id, operatorId, token };
        const txnDbt: any = await updateBalanceFromAccount(debitObj, "DEBIT", playerDetailsForTxn);
        if (!txnDbt) return socket.emit("ERROR", "Bet Cancelled by Upstream");
        const debitTxnId = txnDbt.txn_id;

        parsedPlayerDetails.balance -= totalBetAmount;
        await setCache(infoKey, JSON.stringify(parsedPlayerDetails));
        socket.emit("INFO", parsedPlayerDetails);

        const resPos = Math.floor(Math.random() * 13);
        const { status, winAmt: totalWinAmount, betResults } = isWinner(betData, resPos)
        if (status === "WIN") {
            const cdtTxn = await updateBalanceFromAccount({ ...debitObj, winning_amount: totalBetAmount, txn_id: debitTxnId }, "CREDIT", playerDetailsForTxn);
            if (!cdtTxn) console.error("Credit Txn Failed", JSON.stringify(debitObj));

            parsedPlayerDetails.balance += totalWinAmount;
            await setCache(infoKey, parsedPlayerDetails);
            setTimeout(() => {
                socket.emit("info", parsedPlayerDetails);
            }, 1500);
        }

        socket.emit("bet_result", { totalBetAmount, totalWinAmount, winPosition: resPos, betResults })




        return

    } catch (error: any) {
        console.error("error occured:", error.message);
    }
};

const betDataValidator = (betData: IReqData[]): { invalidBetPayload: number, totalBetAmount: number } => {
    let invalidBetPayload = 0;
    let totalBetAmount = 0;
    betData.forEach((bet: IReqData) => {
        bet.chip.split(",").forEach((chip: string) => {
            const parsedChip = Number(chip);
            if (isNaN(parsedChip) || !(parsedChip >= 0 && parsedChip <= 12)) {
                invalidBetPayload++
            }
        })
        if (isNaN(bet.btAmt)) invalidBetPayload++;
        else totalBetAmount += bet.btAmt;
    })
    return { invalidBetPayload, totalBetAmount };
}

const isWinner = (betData: IReqData[], resultPosition: number): { status: "WIN" | "LOSS", winAmt: number, betResults: IBetResult[] } => {
    let totalWinAmount = 0;
    const betResults: IBetResult[] = []
    betData.forEach((bet: IReqData) => {
        const parsedBetPos = bet.chip.split(",").map((pos: string) => Number(pos));
        if (parsedBetPos.includes(resultPosition)) {
            const winAmt = bet.btAmt * EPayouts[`${bet.chip}`];
            totalWinAmount += winAmt;
            betResults.push({
                chip: bet.chip,
                betAmount: bet.btAmt,
                winAmount: winAmt,
                status: "win",
                mult: EPayouts[`${bet.chip}`]
            })
        }
    })
    if (totalWinAmount) return { status: "WIN", winAmt: totalWinAmount, betResults }
    else return { status: "WIN", winAmt: totalWinAmount, betResults }
}


export const EPayouts: Record<string, number> = {
    "0,2,4,6,8,10,12": 1.1,
    "1,3,5,7,9,11": 1.2,
    "3,6,9,12": 1.3,
    "2,5,8,11": 1.4,
    "1,4,7,10": 1.5,
    "1,2,3,4,5,6": 1.6,
    "4,5,6,7,8,9": 1.7,
    "7,8,9,10,11,12": 1.8,
    "1,3,5,8,10,12": 1.9,
    "2,4,6,7,9,11": 2.0,
    "0": 2.1,
    "1": 2.1,
    "2": 2.1,
    "3": 2.1,
    "4": 2.1,
    "5": 2.1,
    "6": 2.1,
    "7": 2.1,
    "8": 2.1,
    "9": 2.1,
    "10": 2.1,
    "11": 2.1,
    "12": 2.1
};