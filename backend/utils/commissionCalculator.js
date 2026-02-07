const calculateCommissionSplit = (advanceAmount, referralType = 'NONE') => {
  const result = {
    adminCommission: 0,
    referrerCommission: 0,
    customerDiscount: 0,
    referralType: referralType || 'NONE',
  };

  if (!advanceAmount || advanceAmount <= 0) {
    return result;
  }

  switch (referralType) {
    case 'STANDARD':
      result.adminCommission = Math.round(advanceAmount * 0.15 * 100) / 100;
      result.referrerCommission = Math.round(advanceAmount * 0.10 * 100) / 100;
      result.customerDiscount = Math.round(advanceAmount * 0.05 * 100) / 100;
      break;

    case 'SPECIAL':
      result.adminCommission = Math.round(advanceAmount * 0.15 * 100) / 100;
      result.referrerCommission = Math.round(advanceAmount * 0.15 * 100) / 100;
      result.customerDiscount = 0;
      break;

    case 'NONE':
    default:
      result.adminCommission = Math.round(advanceAmount * 0.30 * 100) / 100;
      result.referrerCommission = 0;
      result.customerDiscount = 0;
      break;
  }

  return result;
};

const calculateFinalAmount = (totalAmount, advanceAmount, referralType = 'NONE') => {
  const commission = calculateCommissionSplit(advanceAmount, referralType);

  const finalAdvance = advanceAmount - commission.customerDiscount;

  return {
    originalTotal: totalAmount,
    originalAdvance: advanceAmount,
    customerDiscount: commission.customerDiscount,
    finalAdvance: finalAdvance,
    adminCommission: commission.adminCommission,
    referrerCommission: commission.referrerCommission,
    dueAmount: totalAmount - finalAdvance,
  };
};

const validateCommissionSplit = (referralType, advanceAmount) => {
  if (!['NONE', 'STANDARD', 'SPECIAL'].includes(referralType)) {
    throw new Error('Invalid referral type. Must be NONE, STANDARD, or SPECIAL.');
  }

  if (advanceAmount <= 0) {
    throw new Error('Advance amount must be greater than 0');
  }

  const split = calculateCommissionSplit(advanceAmount, referralType);
  const total = split.adminCommission + split.referrerCommission + split.customerDiscount;

  const expectedTotal = Math.round(advanceAmount * 0.30 * 100) / 100;
  const difference = Math.abs(total - expectedTotal);

  if (difference > 0.02) {
    console.warn(`Commission split doesn't add up correctly. Expected: ${expectedTotal}, Got: ${total}`);
  }

  return true;
};

module.exports = {
  calculateCommissionSplit,
  calculateFinalAmount,
  validateCommissionSplit,
};
