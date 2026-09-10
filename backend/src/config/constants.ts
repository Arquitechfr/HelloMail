import { env } from './env.js';

export const COOKIE_REFRESH_TOKEN = 'hellomail_refresh';

export const JWT_ACCESS_EXPIRES_IN = env.JWT_ACCESS_EXPIRES_IN;
export const JWT_REFRESH_EXPIRES_IN_DAYS = env.JWT_REFRESH_EXPIRES_IN_DAYS;

export const RATE_LIMIT_AUTH_WINDOW_MS = 15 * 60 * 1000;
export const RATE_LIMIT_AUTH_MAX = 10;
