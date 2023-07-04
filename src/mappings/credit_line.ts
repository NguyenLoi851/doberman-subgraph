import { Address } from "@graphprotocol/graph-ts";
import { Bid } from "../../generated/templates/CreditLine/CreditLine";
import { initOrUpdateCreditLine } from "../entities/credit_line";
import { createTransactionFromEvent } from "../entities/helpers";

export function handleBid(event: Bid): void {
    const creditLine = initOrUpdateCreditLine(event.address, event.block.timestamp, Address.zero())
    const transaction = createTransactionFromEvent(
        event,
        "BID",
        event.params.winner
    )
    transaction.transactionHash = event.transaction.hash
    transaction.loan = creditLine.poolAddress.toHexString()
    transaction.sentAmount = event.params.livePrice
    transaction.sentToken = "USDC"
    transaction.save()
}
