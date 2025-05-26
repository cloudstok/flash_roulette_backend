import dotenv from "dotenv";
import { IAppConfig } from "../interfaces";
dotenv.config({ path: ".env" });

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Environment variable ${name} is required but not defined`);
  }
  return value;
}

function requireNumberEnv(name: string): number {
  const value = requireEnv(name);
  const num = Number(value);
  if (isNaN(num)) {
    throw new Error(`Environment variable ${name} must be a valid number`);
  }
  return num;
}

export const appConfig: IAppConfig = {
  minBetAmount: requireNumberEnv("MIN_BET_AMOUNT"),
  maxBetAmount: requireNumberEnv("MAX_BET_AMOUNT"),
  maxCashoutAmount: requireNumberEnv("MAX_CASHOUT"),
  dbConfig: {
    host: requireEnv("DB_HOST"),
    user: requireEnv("DB_USER"),
    password: requireEnv("DB_PASSWORD"),
    database: requireEnv("DB_NAME"),
    port: requireEnv("DB_PORT"),
    retries: requireEnv("DB_MAX_RETRIES"),
    interval: requireEnv("DB_RETRY_INTERVAL"),
  },
  redis: {
    host: requireEnv("REDIS_HOST"),
    port: requireNumberEnv("REDIS_PORT"),
    retry: requireNumberEnv("REDIS_RETRY"),
    interval: requireNumberEnv("REDIS_RETRY_INTERVAL"),
  },
};
