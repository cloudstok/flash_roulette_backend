
import { Server, Socket } from "socket.io";
import { placeBet } from "../module/bets/bets-session";
import { IReqData } from "../interfaces";

export const eventRouter = async (io: Server, socket: Socket): Promise<void> => {
    socket.on('bt', async (data: IReqData[]) => await placeBet(socket, data));
};