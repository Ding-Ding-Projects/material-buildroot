import type { OwnershipReceipt, WslReservationOwner, WslPreciseOwner } from "./index.cjs";
export function createIsoProducerOwner(validateOwner: (value: unknown) => unknown, distribution: string): Readonly<{
  observe(receipt: OwnershipReceipt): Readonly<WslReservationOwner | WslPreciseOwner>;
  precise(): Readonly<WslPreciseOwner>;
}>;
