// Install luxon
import { DateTime } from "luxon"

/**
 * Convert a local date-time to UTC
 * @param {string} dateStr - Date in 'YYYY-MM-DD' format
 * @param {string} timeStr - Time in 'HH:mm' format (24-hour clock)
 * @param {string} timeZone - IANA timezone string (e.g., 'America/Sao_Paulo')
 * @returns {string} UTC datetime in ISO format
 */
export const convertLocalDateTimeToUTC = (dateStr, timeStr, timeZone) => {
  return DateTime.fromFormat(`${dateStr} ${timeStr}`, "yyyy-MM-dd HH:mm", { zone: timeZone })
    .toUTC()
    .toISO({ suppressMilliseconds: false });
}

// Example: Convert 2025-08-09 09:00 Brazil time to UTC
// console.log(toUTC("2025-08-09", "09:00", "America/Sao_Paulo"));
// Output: 2025-08-09T12:00:00Z

export const getCurrentTimeInUTC = () =>  DateTime.utc().toISO({ suppressMilliseconds: false });
