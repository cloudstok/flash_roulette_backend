import { updateBalanceFromAccount } from '../../utilities/common-function';
import { setCache, getCache } from '../../utilities/redis-connection';
import { getUserIP, logEventAndEmitResponse } from '../../utilities/helper-function';
import { createLogger } from '../../utilities/logger';
import { Socket } from 'socket.io';
import { IBetResult, IBetsData, IPlayerDetails, IReqData } from '../../interfaces';
import { randomInt, randomUUID } from 'crypto';
import { addSettlement } from './bets-db';
const logger = createLogger('Bets', 'jsonl');

export const placeBet = async (socket: Socket, betData: IReqData[]) => {
    try {
        const infoKey = `PL:${socket.id}`
        const playerDetails = await getCache(infoKey);
        if (!playerDetails) {
            return socket.emit('betError', { message: 'Invalid Player Details', status: false });
        }

        const parsedPlayerDetails = JSON.parse(playerDetails);
        const { userId, operatorId, token, game_id, balance } = parsedPlayerDetails;

        const { invalidBetPayload, totalBetAmount } = betDataValidator(betData);
        if (invalidBetPayload) return logEventAndEmitResponse(socket, betData, "Invalid Bet Amount/Payload", "bet")

        if (balance < totalBetAmount || balance - totalBetAmount < 0) return logEventAndEmitResponse(socket, betData, "Not enough balance to place this bet", "bet")

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
        if (!txnDbt) return socket.emit("betError", "Bet Cancelled By Upstream");
        const debitTxnId = txnDbt.txn_id;

        parsedPlayerDetails.balance -= totalBetAmount;
        await setCache(infoKey, JSON.stringify(parsedPlayerDetails));

        socket.emit("bet_placed", { matchId, totalBetAmount, balance: parsedPlayerDetails.balance, message: "BET PlACED SUCCESSFULLY" });
        socket.emit("info", {
            name: parsedPlayerDetails.name,
            user_id: userId,
            balance: parsedPlayerDetails.balance,
            game_id: parsedPlayerDetails.game_id,
            operator_id: parsedPlayerDetails.operatorId
        });

        const resPos = Math.floor(Math.random() * 13);
        const { status, winAmt, betResults, color } = isWinner(betData, resPos)

        if (status === "WIN") {
            setTimeout(async () => {
                const cdtTxn = await updateBalanceFromAccount({ ...debitObj, winning_amount: winAmt, txn_id: debitTxnId }, "CREDIT", playerDetailsForTxn);
                if (!cdtTxn) console.error("Credit Txn Failed", JSON.stringify(debitObj));
                parsedPlayerDetails.balance += winAmt;
                await setCache(infoKey, JSON.stringify(parsedPlayerDetails));
                socket.emit("info", {
                    name: parsedPlayerDetails.name,
                    user_id: userId,
                    balance: parsedPlayerDetails.balance,
                    game_id: parsedPlayerDetails.game_id,
                    operator_id: parsedPlayerDetails.operatorId
                });
            }, 4000);
        };
        const stmtObj = { lobby_id: matchId, user_id: userId, operator_id: parsedPlayerDetails.operatorId, bet_amount: totalBetAmount, win_amount: winAmt, user_bets: betResults, win_pos: resPos, color }
        logger.info(JSON.stringify(stmtObj))
        await addSettlement(stmtObj)
        socket.emit("bet_result", { totalBetAmount, totalWinAmount: winAmt, winPosition: resPos, betResults, color })

        return
    } catch (error: any) {
        logger.error({ error: error.message })
        return logEventAndEmitResponse(socket, betData, error.message, "bet");
    }
};

const betDataValidator = (betData: IReqData[]): { invalidBetPayload: number, totalBetAmount: number } => {
    let invalidBetPayload = 0;
    let totalBetAmount = 0;
    if (!betData || !Array.isArray(betData) || betData.length <= 0 || betData.length > 6) {
        return { invalidBetPayload: 1, totalBetAmount: 0 };
    }
    betData.forEach((bet: IReqData) => {
        const convertedBetChip = bet.chip.split("-")
        const parsedChipsArr: number[] = []
        convertedBetChip.forEach((chip: string) => {
            const parsedChip = Number(chip);
            if (isNaN(parsedChip) || !(parsedChip >= 0 && parsedChip <= 12)) {
                invalidBetPayload++
            } else parsedChipsArr.push(parsedChip);
        })
        bet.chip = parsedChipsArr.sort((a: number, b: number) => a - b).join("-");
        if (isNaN(bet.btAmt)) invalidBetPayload++;
        else if (!EPayouts[`${bet.chip}`] || bet.btAmt <= 0) invalidBetPayload++;
        else if (bet.btAmt < EPayouts[`${bet.chip}`].min_bet || bet.btAmt > EPayouts[`${bet.chip}`].max_bet) invalidBetPayload++;
        else totalBetAmount += bet.btAmt;
    })
    return { invalidBetPayload, totalBetAmount };
}

const isWinner = (betData: IReqData[], resultPosition: number): { status: "WIN" | "LOSS", winAmt: number, betResults: IBetResult[], color: "red" | "black" | "white" | "" } => {
    let totalWinAmount = 0;
    const betResults: IBetResult[] = []
    betData.forEach((bet: IReqData) => {
        const parsedBetPos = bet.chip.split("-").map((pos: string) => Number(pos));
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

    const reds = [1, 3, 5, 8, 10, 12];
    const blacks = [2, 4, 6, 7, 9, 11];
    let color: "red" | "black" | "white" | "" = "";
    resultPosition = Number(resultPosition);
    if (reds.includes(resultPosition)) color = "red";
    else if (blacks.includes(resultPosition)) color = "black"
    else if (resultPosition == 0) color = "white";

    if (totalWinAmount) return { status: "WIN", winAmt: totalWinAmount, betResults, color }
    else return { status: "LOSS", winAmt: totalWinAmount, betResults, color }
}

/*
Pay table to simplified:
Red, Black, Odd & Even : 2x
Half Dozen : 2x
Column: 3x
Corner, Four: 3x
Street, Three: 4x
Split: 6x
Straight Up: 12x 
*/

export const EPayouts: Record<string, { mult: number, min_bet: number, max_bet: number }> = {
    "0-2-4-6-8-10-12": { mult: 2, min_bet: 20, max_bet: 50000 },  // Even numbers payout
    "1-3-5-7-9-11": { mult: 2, min_bet: 20, max_bet: 50000 },  // Odd numbers payout
    "1-3-5-8-10-12": { mult: 2, min_bet: 20, max_bet: 50000 }, // red numbers payout
    "2-4-6-7-9-11": { mult: 2, min_bet: 20, max_bet: 50000 },  // black numbers payout
    "3-6-9-12": { mult: 3, min_bet: 20, max_bet: 25000 },  // row payouts
    "2-5-8-11": { mult: 3, min_bet: 20, max_bet: 25000 },  // row payouts
    "1-4-7-10": { mult: 3, min_bet: 20, max_bet: 25000 },  // row payouts
    "1-2-3-4-5-6": { mult: 2, min_bet: 20, max_bet: 25000 },   // 1-6 payout
    "4-5-6-7-8-9": { mult: 2, min_bet: 20, max_bet: 25000 },   // 4-9 payout
    "7-8-9-10-11-12": { mult: 2, min_bet: 20, max_bet: 25000 },  // 7-12 payout
    "1-2-3": { mult: 4, min_bet: 20, max_bet: 25000 },   // 1st column payout
    "4-5-6": { mult: 4, min_bet: 20, max_bet: 25000 },   // 2nd column payout
    "7-8-9": { mult: 4, min_bet: 20, max_bet: 25000 },   // 3rd column payout
    "10-11-12": { mult: 4, min_bet: 20, max_bet: 25000 },  // 4th column payout
    "1-2-4-5": { mult: 3, min_bet: 20, max_bet: 25000 },
    "2-3-5-6": { mult: 3, min_bet: 20, max_bet: 25000 },
    "4-5-7-8": { mult: 3, min_bet: 20, max_bet: 25000 },
    "5-6-8-9": { mult: 3, min_bet: 20, max_bet: 25000 },
    "7-8-10-11": { mult: 3, min_bet: 20, max_bet: 25000 },
    "8-9-11-12": { mult: 3, min_bet: 20, max_bet: 25000 },
    // duo number payouts
    "1-2": { mult: 6, min_bet: 20, max_bet: 25000 },
    "2-3": { mult: 6, min_bet: 20, max_bet: 25000 },
    "4-5": { mult: 6, min_bet: 20, max_bet: 25000 },
    "5-6": { mult: 6, min_bet: 20, max_bet: 25000 },
    "7-8": { mult: 6, min_bet: 20, max_bet: 25000 },
    "8-9": { mult: 6, min_bet: 20, max_bet: 25000 },
    "10-11": { mult: 6, min_bet: 20, max_bet: 25000 },
    "11-12": { mult: 6, min_bet: 20, max_bet: 25000 },
    "1-4": { mult: 6, min_bet: 20, max_bet: 25000 },
    "2-5": { mult: 6, min_bet: 20, max_bet: 25000 },
    "3-6": { mult: 6, min_bet: 20, max_bet: 25000 },
    "4-7": { mult: 6, min_bet: 20, max_bet: 25000 },
    "5-8": { mult: 6, min_bet: 20, max_bet: 25000 },
    "6-9": { mult: 6, min_bet: 20, max_bet: 25000 },
    "7-10": { mult: 6, min_bet: 20, max_bet: 25000 },
    "8-11": { mult: 6, min_bet: 20, max_bet: 25000 },
    "9-12": { mult: 6, min_bet: 20, max_bet: 25000 },
    // single number payouts
    "0": { mult: 12, min_bet: 20, max_bet: 25000 },
    "1": { mult: 12, min_bet: 20, max_bet: 25000 },
    "2": { mult: 12, min_bet: 20, max_bet: 25000 },
    "3": { mult: 12, min_bet: 20, max_bet: 25000 },
    "4": { mult: 12, min_bet: 20, max_bet: 25000 },
    "5": { mult: 12, min_bet: 20, max_bet: 25000 },
    "6": { mult: 12, min_bet: 20, max_bet: 25000 },
    "7": { mult: 12, min_bet: 20, max_bet: 25000 },
    "8": { mult: 12, min_bet: 20, max_bet: 25000 },
    "9": { mult: 12, min_bet: 20, max_bet: 25000 },
    "10": { mult: 12, min_bet: 20, max_bet: 25000 },
    "11": { mult: 12, min_bet: 20, max_bet: 25000 },
    "12": { mult: 12, min_bet: 20, max_bet: 25000 }
};  