import { Server, Socket } from 'socket.io';
import { getUserDataFromSource } from './module/players/player-event';
import { eventRouter } from './router/event-router';
import { setCache, deleteCache, getCache } from './utilities/redis-connection';
import { createLogger } from './utilities/logger';

const logger = createLogger('Socket');
  
export const initSocket = (io: Server): void => {

  io.on('connection', async (socket: Socket) => {
    const { token, game_id } = socket.handshake.query as { token?: string; game_id?: string };

    if (!token || !game_id) {
      socket.disconnect(true);
      console.log('Mandatory params missing', token);
      return;
    }

    const userData = await getUserDataFromSource(token, game_id);

    if (!userData) {
      console.log('Invalid token', token);
      socket.disconnect(true);
      return;
    }

    const isUserExist = await getCache(userData.id);
    if (isUserExist) {
        console.log("User already connected from a platform, disconnecting older resource....");
        const socket = io.sockets.sockets.get(isUserExist);
        if (socket) {
            socket.emit('betError', 'User connected from another source');
            socket.disconnect(true);
        }
    }

    userData.balance = Number(userData.balance);
    socket.emit('info',
      {
        user_id: userData.userId,
        operator_id: userData.operatorId,
        balance: userData.balance,
      },
    );

    await setCache(`PL:${socket.id}`, JSON.stringify({ ...userData, socketId: socket.id }), 3600);
    await setCache(userData.id, socket.id);

    eventRouter(io, socket);

    socket.on('disconnect', async () => {
      logger.info('Server Disconnected : Deleted the cache of user')
      await deleteCache(userData.id);
      await deleteCache(`PL:${socket.id}`);
    });

    socket.on('error', (error: Error) => {
      console.error(`Socket error: ${socket.id}. Error: ${error.message}`);
    });
  });
};