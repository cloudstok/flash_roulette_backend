import { BetData, Settlement } from '../../interfaces';
import { write } from '../../utilities/db-connection';

const SQL_INSERT_BETS = 'INSERT INTO bets (bet_id, lobby_id, user_id, operator_id, bet_amount, userBets) VALUES(?,?,?,?,?,?)';

export const addSettleBet = async (settlements: Settlement[]): Promise<void> => {
  try {
    if (settlements.length > 0) {
      const finalData: any[] = [];

      for (const settlement of settlements) {
        const { bet_id, totalBetAmount, userBets, result, totalMaxMult, winAmount } = settlement;
        const [initial, lobby_id, user_id, operator_id] = bet_id.split(':');
        finalData.push([
          bet_id,
          lobby_id,
          decodeURIComponent(user_id),
          operator_id,
          Number(totalBetAmount).toFixed(2),
          JSON.stringify(userBets),
          JSON.stringify(result),
          totalMaxMult,
          winAmount
        ]);
      }

      const placeholders = finalData.map(() => '(?, ?, ?, ?, ?, ?, ?, ?, ?)').join(',');
      const SQL_SETTLEMENT = `INSERT INTO settlement (bet_id, lobby_id, user_id, operator_id, bet_amount, userBets, result, max_mult, win_amount) VALUES ${placeholders}`;
      const flattenedData = finalData.flat();

      await write(SQL_SETTLEMENT, flattenedData);
      console.info('Settlement Data Inserted Successfully');
    } else {
      console.info('No Settlement data for insertion');
    }
  } catch (err) {
    console.error(err);
  }
};

export const insertBets = async (data: BetData): Promise<void> => {
  try {
    const { bet_id, totalBetAmount, userBets } = data;
    const [initial, lobby_id, user_id, operator_id] = bet_id.split(':');
    await write(SQL_INSERT_BETS, [
      bet_id,
      lobby_id,
      decodeURIComponent(user_id),
      operator_id,
      Number(totalBetAmount).toFixed(2),
      JSON.stringify(userBets)
    ]);
    console.info(`Bet placed successfully for user`, user_id);
  } catch (err) {
    console.error(err);
  }
};