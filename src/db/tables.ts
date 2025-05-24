export const settlement = `CREATE TABLE IF NOT EXISTS settlement (
   settlement_id int AUTO_INCREMENT PRIMARY KEY,
   lobby_id varchar(255) NOT NULL,
   user_id varchar(255) NOT NULL,
   operator_id varchar(255) DEFAULT NULL,
   bet_amount decimal(10, 2) NOT NULL DEFAULT 0.00,
   win_amount decimal(10, 2) DEFAULT 0.00,
   user_bets json,
   win_pos smallint,
   created_at timestamp NULL DEFAULT CURRENT_TIMESTAMP
 );`