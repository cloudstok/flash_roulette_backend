import { updateBalanceFromAccount } from '../../utilities/common-function';
import { appConfig } from '../../utilities/app-config';
import { setCache, getCache } from '../../utilities/redis-connection';
import { getBetResult, getUserIP, logEventAndEmitResponse } from '../../utilities/helper-function';
import { createLogger } from '../../utilities/logger';
import { Server, Socket } from 'socket.io';
import { ReqData } from '../../interfaces';
const logger = createLogger('Bets', 'jsonl');

export const placeBet = async (socket: Socket, betData: ReqData[]) => {
try{

}catch(err){

}
    const playerDetails = await getCache(`PL:${socket.id}`);
    if (!playerDetails) {
        return socket.emit('message', { eventName: 'betError', data: { message: 'Invalid Player Details', status: false } });
    }

    const parsedPlayerDetails = JSON.parse(playerDetails);
    const { userId, operatorId, token, game_id, balance } = parsedPlayerDetails;
    const betObj = { bet_id, token, socket_id: parsedPlayerDetails.socketId, game_id, roomId };
};