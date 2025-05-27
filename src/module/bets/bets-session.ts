import { updateBalanceFromAccount } from '../../utilities/common-function';
import { appConfig } from '../../utilities/app-config';
import { setCache, getCache } from '../../utilities/redis-connection';
import { getUserIP, logEventAndEmitResponse } from '../../utilities/helper-function';
import { createLogger } from '../../utilities/logger';
import { Socket } from 'socket.io';
import { IBetResult, IBetsData, IPlayerDetails, IReqData } from '../../interfaces';
import { randomUUID } from 'crypto';
import { addSettlement } from './bets-db';
const logger = createLogger('Bets', 'jsonl');

export const placeBet = async (socket: Socket, betData: IReqData[]) => {
    try {
        console.log("placeBet called", betData);
        const infoKey = `PL:${socket.id}`
        const playerDetails = await getCache(infoKey);
        console.log({ playerDetails, betData });
        if (!playerDetails) {
            return socket.emit('message', { eventName: 'betError', data: { message: 'Invalid Player Details', status: false } });
        }

        const parsedPlayerDetails = JSON.parse(playerDetails);
        const { userId, operatorId, token, game_id, balance } = parsedPlayerDetails;

        const { invalidBetPayload, totalBetAmount } = betDataValidator(betData);
        if (invalidBetPayload) logEventAndEmitResponse(socket, betData, "Invalid Bet Amount/Payload", "bet")

        // if (totalBetAmount > appConfig.maxBetAmount || totalBetAmount < appConfig.minBetAmount) {
        //     return socket.emit("ERROR", "Bet amount out of range");
        // }

        if (balance < totalBetAmount) {
            return socket.emit("ERROR", "Not enough balance to place this bet");
        }
        if (balance - totalBetAmount < 0) {
            return socket.emit("ERROR", "Not enough balance to place this bet");
        }

        const matchId = randomUUID();
        const debitObj: IBetsData = {
            bet_id: matchId,
            bet_amount: totalBetAmount,
            game_id: game_id,
            user_id: userId,
            ip: getUserIP(socket),
            id: matchId
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
            await setCache(infoKey, JSON.stringify(parsedPlayerDetails));
            setTimeout(() => {
                socket.emit("info", parsedPlayerDetails);
            }, 1500);
        }
        const stmtObj = { lobby_id: matchId, user_id: userId, operator_id: operatorId, bet_amount: totalBetAmount, win_amount: totalWinAmount, user_bets: betResults, win_pos: resPos }
        logger.info(stmtObj)
        await addSettlement(stmtObj)
        socket.emit("bet_result", { totalBetAmount, totalWinAmount, winPosition: resPos, betResults })

        return

    } catch (error: any) {
        logger.error({ error: error.message })
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
        else if (bet.btAmt < EPayouts[`${bet.chip}`].min_bet) invalidBetPayload++;
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
            const winAmt = bet.btAmt * EPayouts[`${bet.chip}`].mult;
            totalWinAmount += winAmt;
            betResults.push({
                chip: bet.chip,
                betAmount: bet.btAmt,
                winAmount: winAmt,
                status: "win",
                mult: EPayouts[`${bet.chip}`].mult
            })
        } else {
            betResults.push({
                chip: bet.chip,
                betAmount: bet.btAmt,
                winAmount: 0,
                status: "loss",
                mult: 0
            })
        }
    })
    if (totalWinAmount) return { status: "WIN", winAmt: totalWinAmount, betResults }
    else return { status: "WIN", winAmt: totalWinAmount, betResults }
}


export const EPayouts: Record<string, { mult: number, min_bet: number }> = {
    "0,2,4,6,8,10,12": { mult: 1, min_bet: 50000 },  // Even numbers payout
    "1,3,5,7,9,11": { mult: 1, min_bet: 50000 },  // Odd numbers payout
    "3,6,9,12": { mult: 2, min_bet: 25000 },  // row payouts
    "2,5,8,11": { mult: 2, min_bet: 25000 },  // row payouts
    "1,4,7,10": { mult: 2, min_bet: 25000 },  // row payouts
    "1,2,3,4,5,6": { mult: 1, min_bet: 25000 },   // 1-6 payout
    "4,5,6,7,8,9": { mult: 1, min_bet: 25000 },   // 4-9 payout
    "7,8,9,10,11,12": { mult: 1, min_bet: 25000 },  // 7-12 payout
    "1,3,5,8,10,12": { mult: 1, min_bet: 25000 }, // red numbers payout
    "2,4,6,7,9,11": { mult: 1, min_bet: 25000 },  // black numbers payout
    "1,2,3": { mult: 3, min_bet: 25000 },   // 1st column payout
    "4,5,6": { mult: 3, min_bet: 25000 },   // 2nd column payout
    "7,8,9": { mult: 3, min_bet: 25000 },   // 3rd column payout
    "10,11,12": { mult: 3, min_bet: 25000 },  // 4th column payout
    "0,1,2": { mult: 3, min_bet: 25000 },
    "0,2,3": { mult: 3, min_bet: 25000 },
    "0,1,2,3": { mult: 3, min_bet: 25000 },
    // duo number payouts
    "1,2": { mult: 5, min_bet: 25000 },
    "2,3": { mult: 5, min_bet: 25000 },
    "4,5": { mult: 5, min_bet: 25000 },
    "5,6": { mult: 5, min_bet: 25000 },
    "7,8": { mult: 5, min_bet: 25000 },
    "8,9": { mult: 5, min_bet: 25000 },
    "10,11": { mult: 5, min_bet: 25000 },
    "11,12": { mult: 5, min_bet: 25000 },
    "1,4": { mult: 5, min_bet: 25000 },
    "2,5": { mult: 5, min_bet: 25000 },
    "3,6": { mult: 5, min_bet: 25000 },
    "4,7": { mult: 5, min_bet: 25000 },
    "5,8": { mult: 5, min_bet: 25000 },
    "6,9": { mult: 5, min_bet: 25000 },
    "7,10": { mult: 5, min_bet: 25000 },
    "8,11": { mult: 5, min_bet: 25000 },
    "9,12": { mult: 5, min_bet: 25000 },
    // single number payouts
    "0": { mult: 11, min_bet: 20 },
    "1": { mult: 11, min_bet: 20 },
    "2": { mult: 11, min_bet: 20 },
    "3": { mult: 11, min_bet: 20 },
    "4": { mult: 11, min_bet: 20 },
    "5": { mult: 11, min_bet: 20 },
    "6": { mult: 11, min_bet: 20 },
    "7": { mult: 11, min_bet: 20 },
    "8": { mult: 11, min_bet: 20 },
    "9": { mult: 11, min_bet: 20 },
    "10": { mult: 11, min_bet: 20 },
    "11": { mult: 11, min_bet: 20 },
    "12": { mult: 11, min_bet: 20 }
};