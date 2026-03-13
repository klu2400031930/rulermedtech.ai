const CryptoJS = require('crypto-js');

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'rural-health-aes-256-key-2024!!';

const encrypt = (data) => {
    if (typeof data === 'object') data = JSON.stringify(data);
    return CryptoJS.AES.encrypt(data, ENCRYPTION_KEY).toString();
};

const decrypt = (ciphertext) => {
    const bytes = CryptoJS.AES.decrypt(ciphertext, ENCRYPTION_KEY);
    const decrypted = bytes.toString(CryptoJS.enc.Utf8);
    try {
        return JSON.parse(decrypted);
    } catch {
        return decrypted;
    }
};

module.exports = { encrypt, decrypt };
