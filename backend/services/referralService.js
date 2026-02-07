const ReferralRepository = require('../repositories/referralRepository');
const QRCode = require('qrcode');
const { calculateCommissionSplit } = require('../utils/commissionCalculator');

const ReferralService = {
  async getTopEarners(period) {
    if (!['month', 'all'].includes(period)) {
      period = 'all';
    }
    return ReferralRepository.getTopEarners(period);
  },

  async getShareInfo(userId) {
    const user = await ReferralRepository.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    if (user.status === 'blocked') {
      throw new Error('Account is blocked');
    }

    const referralCode = user.referral_code.toUpperCase();
    const domain = process.env.REPLIT_DEV_DOMAIN || 'your-domain.com';
    const referralLink = `https://${domain}/?ref=${referralCode}`;
    
    // Generate QR code as data URI
    const referralQrCode = await QRCode.toDataURL(referralLink, {
      width: 400,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#ffffff'
      }
    });

    return {
      referralCode,
      referralLink,
      referralQrCode
    };
  },

  async validateReferralCode(code, guestPhone) {
    if (!code || code.trim() === '') {
      return { valid: false, error: 'Referral code is required' };
    }

    const validation = await ReferralRepository.validateReferralCode(code, guestPhone);

    if (!validation.valid) {
      return validation;
    }

    return {
      valid: true,
      referralUserId: validation.referralUserId,
      referralCode: validation.referralCode,
      referralType: validation.referralType,
      username: validation.username,
      discountPercentage: validation.referralType === 'STANDARD' ? 5 : 0,
    };
  },

  async calculateReferralBenefit(advanceAmount, referralType) {
    const commission = calculateCommissionSplit(advanceAmount, referralType);
    return {
      customerDiscount: commission.customerDiscount,
      referrerEarning: commission.referrerCommission,
      adminCommission: commission.adminCommission,
    };
  }
};

module.exports = ReferralService;