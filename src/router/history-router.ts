import express, { Request, Response, Router } from 'express';
import { read } from '../utilities/db-connection';

const apiRouter: Router = express.Router();

interface HistoryQuery {
    user_id?: string;
    operator_id?: string;
    limit?: string;
}

interface BetDetailQuery {
    operator_id?: string;
    user_id?: string;
    lobby_id?: string;
}

apiRouter.get('/history', async (req: Request<{}, {}, {}, HistoryQuery>, res: Response): Promise<void> => {
    try {
        const { user_id, operator_id, limit } = req.query;

        if (!user_id || !operator_id) {
            res.status(400).json({ status: false, error: 'Bad Request: Missing user_id or operator_id' });
            return;
        }

        const limitNumber = limit ? parseInt(limit, 10) : 20;

        const data = await getHistory({ user_id, operator_id, limit: limitNumber });

        res.status(200).json({ status: true, data });
    } catch (err) {
        console.error(err);
        res.status(500).json({ status: false, error: 'Internal Server Error' });
    }
});


apiRouter.get('/bet/detail', async (req: Request<{}, {}, {}, BetDetailQuery>, res: Response): Promise<void> => {
    try {
        const { operator_id, user_id, lobby_id } = req.query;

        if (!operator_id || !user_id || !lobby_id) {
            res.status(400).json({ status: false, message: 'Missing required query parameters' });
            return;
        }

        const SQL_ROUND_HISTORY = `
            SELECT bet_amount, win_amount, win_pos, created_at, user_bets
            FROM settlement 
            WHERE user_id = ? AND operator_id = ? AND lobby_id = ?
            LIMIT 1
        `;

        const [record] = await read(SQL_ROUND_HISTORY, [user_id, operator_id, lobby_id]);

        const finalData = {
            user_id,
            operator_id,
            lobby_id,
            bet_amount: record?.bet_amount ?? 0,
            win_amount: record?.win_amount ?? 0,
            win_pos: record?.win_pos ?? 0,
            created_at: record?.created_at ?? '',
            user_bets: record?.user_bets ?? [],
        };

        res.status(200).json({ status: true, data: finalData });

    } catch (err) {
        console.error('Error fetching bet detail:', err);
        res.status(500).json({ status: false, error: 'Internal Server Error' });
    }
});


export const getHistory = async ({
    user_id,
    operator_id,
    limit = 10,
}: {
    user_id: string;
    operator_id: string;
    limit?: number;
}): Promise<any> => {
    try {
        const safeLimit = Number.isInteger(limit) && limit > 0 ? limit : 10;

        const sql = `
            SELECT 
                *
            FROM 
                settlement
            WHERE 
                user_id = ? AND operator_id = ?
            ORDER BY created_at DESC
            LIMIT ${safeLimit}
        `;

        const data = await read(sql, [user_id, operator_id]);

        return data;
    } catch (err) {
        console.error(`Err while getting data from table:`, err);
        return { err };
    }
};

export default apiRouter;
