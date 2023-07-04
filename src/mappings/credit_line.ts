import { Bid } from "../../generated/templates/CreditLine/CreditLine";
import { initOrUpdateCreditLine } from "../entities/credit_line";

export function handleBid(event: Bid): void {
    initOrUpdateCreditLine(event.address, event.block.timestamp)
}
