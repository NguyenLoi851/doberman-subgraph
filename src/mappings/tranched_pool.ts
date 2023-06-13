import { log } from "@graphprotocol/graph-ts"
import { DepositMade } from "../../generated/templates/TranchedPool/TranchedPool"
import { handleDeposit } from "../entities/tranched_pool"

export function handleDepositMade(event: DepositMade): void {
    handleDeposit(event)

    // const transaction = createTransactionFromEvent(event, "TRANCHED_POOL_DEPOSIT", event.params.owner)
    // transaction.loan = event.address.toHexString()
    // transaction.sentAmount = event.params.amount
    // transaction.sentToken = "USDC"
    // transaction.receivedNftId = event.params.tokenId.toString()
    // transaction.receivedNftType = "POOL_TOKEN"
    // transaction.save()

    // createZapMaybe(event)
}
