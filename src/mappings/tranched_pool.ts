import { Bytes, log } from "@graphprotocol/graph-ts"
import { TranchedPool } from "../../generated/schema"
import { TranchedPool as TranchedPoolContract, DepositMade, DrawdownMade, TrancheLocked } from "../../generated/templates/TranchedPool/TranchedPool"
import { initOrUpdateCreditLine } from "../entities/credit_line"
import { updateTotalDrawdowns } from "../entities/protocol"
import { getOrInitTranchedPool, handleDeposit, handleLockTranche, initOrUpdateTranchedPool, updatePoolCreditLine } from "../entities/tranched_pool"
import { getOrInitUser } from "../entities/user"
import { handleCreditLineBalanceChanged } from "./senior_pool/helpers"

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

export function handleTrancheLocked(event: TrancheLocked): void {
    handleLockTranche(event)
}


export function handleDrawdownMade(event: DrawdownMade): void {
    const tranchedPool = getOrInitTranchedPool(event.address, event.block.timestamp, Bytes.fromHexString('0x'))
    // const tranchedPool = assert(TranchedPool.load(event.address.toHexString()))
    getOrInitUser(event.params.borrower) // ensures that a wallet making a drawdown is correctly considered a user
    updatePoolCreditLine(event.address, event.block.timestamp)
    initOrUpdateTranchedPool(event.address, event.block.timestamp, Bytes.fromHexString('0x'))
    const contract = TranchedPoolContract.bind(event.address)
    const creditLineAddress = contract.creditLine()
    const creditLine = initOrUpdateCreditLine(creditLineAddress, event.block.timestamp)

    tranchedPool.termStartTime = creditLine.termStartTime
    tranchedPool.termEndTime = creditLine.termEndTime
    tranchedPool.nextDueTime = creditLine.nextDueTime
    // updatePoolTokensRedeemable(tranchedPool)
    // deleteTranchedPoolRepaymentSchedule(tranchedPool)
    // const schedulingResult = generateRepaymentScheduleForTranchedPool(tranchedPool)
    // tranchedPool.repaymentSchedule = schedulingResult.repaymentIds
    // tranchedPool.numRepayments = schedulingResult.repaymentIds.length
    // tranchedPool.termInSeconds = schedulingResult.termInSeconds
    // tranchedPool.repaymentFrequency = schedulingResult.repaymentFrequency
    tranchedPool.save()

    // const transaction = createTransactionFromEvent(event, "TRANCHED_POOL_DRAWDOWN", event.params.borrower)
    // transaction.loan = event.address.toHexString()
    // transaction.receivedAmount = event.params.amount
    // transaction.receivedToken = "USDC"
    // transaction.save()

    handleCreditLineBalanceChanged()

    updateTotalDrawdowns(event.params.amount)

    // calculateApyFromGfiForAllPools()
}
