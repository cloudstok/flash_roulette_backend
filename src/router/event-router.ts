
import { Server, Socket } from "socket.io";
import { placeBet } from "../module/bets/bets-session";
import { ReqData } from "../interfaces";

export const eventRouter = async (io: Server, socket: Socket): Promise<void> => {
    socket.on('bt', async(data: ReqData[]) =>  await placeBet(socket, data));
};