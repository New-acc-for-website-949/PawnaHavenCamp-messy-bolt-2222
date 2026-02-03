const crypto = require('crypto');

class PaytmChecksum {
  static iv = '@@@@&&&&####$$$$';

  static encrypt(input, key) {
    const cipher = crypto.createCipheriv('aes-128-cbc', Buffer.from(key), Buffer.from(this.iv));
    let encrypted = cipher.update(input, 'utf8', 'base64');
    encrypted += cipher.final('base64');
    return encrypted;
  }

  static decrypt(encrypted, key) {
    const decipher = crypto.createDecipheriv('aes-128-cbc', Buffer.from(key), Buffer.from(this.iv));
    let decrypted = decipher.update(encrypted, 'base64', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }

  static generateSignature(params, key) {
    const hmac = crypto.createHmac('sha256', key);
    hmac.update(params);
    return hmac.digest('base64');
  }

  static async verifySignature(params, key, checksum) {
    try {
      const paytmHash = this.decrypt(checksum, key);
      const salt = paytmHash.substring(paytmHash.length - 4);
      const calculatedChecksum = this.generateSignature(params + salt, key);
      return calculatedChecksum === paytmHash.substring(0, paytmHash.length - 4);
    } catch (error) {
      console.error('Checksum verification error:', error);
      return false;
    }
  }

  static generateRandomString(length) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  static async generateChecksum(params, key) {
    const sortedParams = Object.keys(params)
      .sort()
      .reduce((acc, k) => {
        if (params[k] !== null && params[k] !== undefined && params[k] !== '') {
          acc[k] = params[k];
        }
        return acc;
      }, {});

    const paramsString = Object.keys(sortedParams)
      .map(k => `${k}=${sortedParams[k]}`)
      .join('&');

    const salt = this.generateRandomString(4);
    const signature = this.generateSignature(paramsString + salt, key);
    const checksum = signature + salt;

    return this.encrypt(checksum, key);
  }

  static async verifyChecksumByObject(params, key, checksum) {
    const paramsWithoutChecksum = { ...params };
    delete paramsWithoutChecksum.CHECKSUMHASH;

    const sortedParams = Object.keys(paramsWithoutChecksum)
      .sort()
      .reduce((acc, k) => {
        if (paramsWithoutChecksum[k] !== null && paramsWithoutChecksum[k] !== undefined && paramsWithoutChecksum[k] !== '') {
          acc[k] = paramsWithoutChecksum[k];
        }
        return acc;
      }, {});

    const paramsString = Object.keys(sortedParams)
      .map(k => `${k}=${sortedParams[k]}`)
      .join('&');

    return await this.verifySignature(paramsString, key, checksum);
  }
}

module.exports = { PaytmChecksum };
