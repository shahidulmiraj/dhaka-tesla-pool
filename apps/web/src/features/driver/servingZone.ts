// The zone a driver serves lives in this browser (drivers have no GPS position).
const KEY = 'tp_driver_zone';

export const readServingZone = () => Number(localStorage.getItem(KEY)) || 0;
export const writeServingZone = (zoneId: number) => localStorage.setItem(KEY, String(zoneId));
