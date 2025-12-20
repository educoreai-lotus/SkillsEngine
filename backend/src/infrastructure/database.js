/**
 * Database Compatibility Layer
 *
 * This module exists primarily so that handlers (like the Content Studio
 * handler) can `require('../../infrastructure/database')` without causing
 * MODULE_NOT_FOUND errors.
 *
 * The long‑term goal is for this layer to provide a simple, uniform
 * `query(sql, params?)` API backed by Supabase or another database client.
 * For now, it is intentionally minimal and will cause individual queries
 * to fail gracefully, allowing higher‑level fallback logic to run.
 */

// We keep a loose dependency on the Supabase configuration so that when
// we implement real SQL execution, we already have access to the client.
const { getSupabaseClient } = require('../../config/database');

/**
 * Execute a read‑only SQL query.
 *
 * NOTE: This is currently a placeholder implementation. It logs the
 * incoming query and then throws an error so that callers with
 * per‑query error handling (like ContentStudioHandler.executeQueries)
 * can catch it and fall back to safer logic.
 *
 * @param {string} sql - The SQL text to execute
 * @param {Array|Object} [params] - Optional parameters (unused for now)
 * @returns {Promise<Array>} rows
 */
async function query(sql, params) {
    // Ensure Supabase is at least configured; this will throw with a clear
    // message if env vars are missing, which is better than silent failure.
    try {
        getSupabaseClient();
    } catch (err) {
        console.warn('[infrastructure/database] Supabase client not ready:', err.message);
    }

    console.warn('[infrastructure/database] query() not yet implemented. Incoming SQL:', {
        sql,
        params,
    });

    // Throw so that callers relying on try/catch around `db.query(...)`
    // can degrade gracefully (e.g., use fallback logic).
    throw new Error('infrastructure/database.query is not implemented yet');
}

module.exports = {
    query,
};








