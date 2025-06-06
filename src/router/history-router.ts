import express, { Request, Response, Router } from 'express';
import { read } from '../utilities/db-connection';
import { EPayouts } from '../module/bets/bets-session';

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

        const settlements = await read(sql, [user_id, operator_id]);
        const flattenedBets = settlements.flatMap((settlement: any) => {
            const winning_number = parseInt(settlement.win_pos);
            return (settlement.user_bets || []).map((bet: any) => {
                const chips = bet.chip.split("-").map((n: string) => n.trim());  // <<--- now strings
                const type = determineType(bet.chip);
                const color = determineColor(chips.map(Number)); // Pass numeric array for logic
                // console.log(chips, type, color);
                return {
                    match_id: settlement.lobby_id,
                    user_id: settlement.user_id,
                    operator_id: settlement.operator_id,
                    numbers: chips, // string array
                    type,
                    color,
                    status: bet.status,
                    winning_number,
                    win_mult: bet.mult,
                    win_amount: bet.winAmount,
                    bet_amount: bet.betAmount,
                    created_at: settlement.created_at,
                };
            });
        });


        return flattenedBets;
    } catch (err) {
        console.error(`Error while getting history:`, err);
        return { status: false, err };
    }
};

function determineType(chip: string): string {
    const key = chip.split("-").map((n: string) => parseInt(n)).sort((a, b) => a - b).join("-");

    if (key === "0-2-4-6-8-10-12") return "Even";
    if (key === "1-3-5-7-9-11") return "Odd";
    if (key === "1-3-5-8-10-12") return "Red";
    if (key === "2-4-6-7-9-11") return "Black";

    const colMap: Record<string, string> = {
        "1-2-3": "Column 1",
        "4-5-6": "Column 2",
        "7-8-9": "Column 3",
        "10-11-12": "Column 4",
    };
    if (colMap[key]) return colMap[key];

    const rowMap: Record<string, string> = {
        "3-6-9-12": "Row 1",
        "2-5-8-11": "Row 2",
        "1-4-7-10": "Row 3",
    };
    if (rowMap[key]) return rowMap[key];

    const rangeMap: Record<string, string> = {
        "1-2-3-4-5-6": "Range 1–6",
        "4-5-6-7-8-9": "Range 4–9",
        "7-8-9-10-11-12": "Range 7–12",
    };
    if (rangeMap[key]) return rangeMap[key];

    const chips = chip.split("-");
    if (chips.length === 1) return "Single Number";
    if (chips.length === 2) return "Double Combo";
    if (chips.length === 4) return "Four Number Combo";

    return `Group (${key})`;
}

function determineColor(numbers: number[]): "red" | "black" | "white" | "" {
    const reds = [1, 3, 5, 8, 10, 12];
    const blacks = [2, 4, 6, 7, 9, 11];

    const isRed = numbers.every(n => reds.includes(n));
    const isBlack = numbers.every(n => blacks.includes(n));
    const isWhite = numbers.every(n => n === 0);

    if (isRed) return "red";
    if (isBlack) return "black";
    if (isWhite) return "white";

    return "";
}

export default apiRouter;
