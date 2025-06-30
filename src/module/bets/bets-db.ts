import { ISettlementDbObject } from '../../interfaces';
import { write } from '../../utilities/db-connection';

const SQL_INSERT_SETTLEMENTS = `INSERT INTO settlement (lobby_id, user_id, operator_id, bet_amount, win_amount, user_bets, win_pos, color) 
VALUES (?, ?, ?, ?, ?, ?, ?, ?);`
export const addSettlement = async (settlement: ISettlementDbObject): Promise<void> => {
  try {
    const { lobby_id, user_id, operator_id, bet_amount, win_amount, user_bets, win_pos, color } = settlement;
    const userId = decodeURIComponent(user_id);
    await write(SQL_INSERT_SETTLEMENTS, [lobby_id, userId, operator_id, bet_amount, win_amount, user_bets, win_pos, color]);
    console.info('Settlement Data Inserted Successfully');
    return;
  } catch (err) {
    console.error(err);
  }
}