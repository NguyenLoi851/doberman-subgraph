import { Bytes, log } from "@graphprotocol/graph-ts"
import { PoolToken, TranchedPool } from "../../generated/schema"
import { TranchedPool as TranchedPoolContract, DepositMade, DrawdownMade, TrancheLocked, WithdrawalMade, PaymentApplied } from "../../generated/templates/TranchedPool/TranchedPool"
import { initOrUpdateCreditLine } from "../entities/credit_line"
import { updateTotalDrawdowns, updateTotalInterestCollected, updateTotalPrincipalCollected, updateTotalReserveCollected } from "../entities/protocol"
import { getOrInitTranchedPool, handleDeposit, handleLockTranche, initOrUpdateTranchedPool, updatePoolCreditLine, updatePoolTokensRedeemable } from "../entities/tranched_pool"
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

export function handleWithdrawalMade(event: WithdrawalMade): void {
    initOrUpdateTranchedPool(event.address, event.block.timestamp, Bytes.fromHexString('0x'))
    updatePoolCreditLine(event.address, event.block.timestamp)

    // const tranchedPoolContract = TranchedPoolContract.bind(event.address)
    // const seniorPoolAddress = getAddressFromConfig(tranchedPoolContract, CONFIG_KEYS_ADDRESSES.SeniorPool)
    const poolToken = assert(PoolToken.load(event.params.tokenId.toString()))
    poolToken.interestRedeemable = poolToken.interestRedeemable.minus(event.params.interestWithdrawn)
    poolToken.save()
    // let underlyingOwner = poolToken.user

    // const transaction = createTransactionFromEvent(
    //   event,
    //   event.params.owner.equals(seniorPoolAddress) ? "SENIOR_POOL_REDEMPTION" : "TRANCHED_POOL_WITHDRAWAL",
    //   Address.fromString(underlyingOwner)
    // )
    // transaction.transactionHash = event.transaction.hash
    // transaction.loan = event.address.toHexString()
    // transaction.sentNftId = event.params.tokenId.toString()
    // transaction.sentNftType = "POOL_TOKEN"
    // transaction.receivedAmount = event.params.interestWithdrawn.plus(event.params.principalWithdrawn)
    // transaction.receivedToken = "USDC"
    // transaction.save()

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

export function handlePaymentApplied(event: PaymentApplied): void {
    getOrInitUser(event.params.payer) // ensures that a wallet making a payment is correctly considered a user
    initOrUpdateTranchedPool(event.address, event.block.timestamp, Bytes.fromHexString('0x'))
    updatePoolCreditLine(event.address, event.block.timestamp)

    const tranchedPool = assert(TranchedPool.load(event.address.toHexString()))
    tranchedPool.principalAmountRepaid = tranchedPool.principalAmountRepaid.plus(event.params.principalAmount)
    tranchedPool.interestAmountRepaid = tranchedPool.interestAmountRepaid.plus(event.params.interestAmount)
    // if (!event.params.principal.isZero()) {
    //   deleteTranchedPoolRepaymentSchedule(tranchedPool)
    //   const schedulingResult = generateRepaymentScheduleForTranchedPool(tranchedPool)
    //   tranchedPool.repaymentSchedule = schedulingResult.repaymentIds
    // }
    tranchedPool.save()

    updatePoolTokensRedeemable(tranchedPool)
    // updatePoolRewardsClaimable(tranchedPool, TranchedPoolContract.bind(event.address))

    // const transaction = createTransactionFromEvent(event, "TRANCHED_POOL_REPAYMENT", event.params.payer)
    // transaction.loan = event.address.toHexString()
    // transaction.sentAmount = event.params.principal.plus(event.params.interest)
    // transaction.sentToken = "USDC"
    // transaction.save()

    updateTotalPrincipalCollected(event.params.principalAmount)
    updateTotalInterestCollected(event.params.interestAmount)
    updateTotalReserveCollected(event.params.reserveAmount)

    handleCreditLineBalanceChanged()
}