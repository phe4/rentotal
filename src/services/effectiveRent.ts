export function calculateEffectiveRent(input: {
  baseRent?: number | null;
  leaseTermMonths?: number | null;
  specialOfferValue?: number | null;
  mandatoryFees?: number | null;
}): number | null {
  if (input.baseRent === undefined || input.baseRent === null) return null;

  const baseRent = input.baseRent;
  const mandatoryFees = input.mandatoryFees ?? 0;
  const leaseTermMonths = input.leaseTermMonths;

  if (!leaseTermMonths || leaseTermMonths <= 0) {
    return roundMoney(Math.max(0, baseRent + mandatoryFees));
  }

  const specialOfferValue = input.specialOfferValue ?? 0;
  const effectiveRent =
    (baseRent * leaseTermMonths - specialOfferValue) / leaseTermMonths +
    mandatoryFees;
  return roundMoney(Math.max(0, effectiveRent));
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}
