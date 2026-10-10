export interface AdditionInput {
  chemical: string;
  amountOz: number;
}

const MAX_CHEMICAL_LENGTH = 60;
const MAX_AMOUNT_OZ = 100;

export function parseAdditionInput(value: unknown): AdditionInput | { error: string } {
  if (!value || typeof value !== "object") {
    return { error: "Invalid addition" };
  }

  const { chemical, amountOz } = value as Record<string, unknown>;
  if (typeof chemical !== "string") {
    return { error: "Chemical is required" };
  }
  const trimmedChemical = chemical.trim();
  if (!trimmedChemical || trimmedChemical.length > MAX_CHEMICAL_LENGTH) {
    return { error: "Chemical must be 1 to 60 characters" };
  }
  if (typeof amountOz !== "number" || !Number.isFinite(amountOz) || amountOz <= 0 || amountOz > MAX_AMOUNT_OZ) {
    return { error: "Amount must be greater than 0 and no more than 100 oz" };
  }

  return { chemical: trimmedChemical, amountOz };
}

export function parseSessionId(value: unknown): number | { error: string } {
  if (typeof value !== "number" || !Number.isInteger(value) || value <= 0) {
    return { error: "Invalid session" };
  }
  return value;
}

export function isAdditionInput(value: AdditionInput | { error: string }): value is AdditionInput {
  return !('error' in value);
}
