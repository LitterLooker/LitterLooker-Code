import crypto from 'crypto';

const hashPassword = (text) => {
  return crypto.createHash('sha256').update(text).digest('hex');
};

console.log("MendTheEarth@MOD:", hashPassword('MendTheEarth@MOD'));
console.log("MendTheEarth@MOD2026:", hashPassword('MendTheEarth@MOD2026'));
