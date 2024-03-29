import { Address, BigDecimal, BigInt, ethereum } from "@graphprotocol/graph-ts"
import { CreditLine, JuniorTrancheInfo, SeniorTrancheInfo, TranchedPool, Transaction } from "../../generated/schema"
import { SeniorPool as SeniorPoolContract } from "../../generated/SeniorPool/SeniorPool"
import { FixedLeverageRatioStrategy } from "../../generated/templates/TranchedPool/FixedLeverageRatioStrategy"
import { getOrInitUser } from "./user"

const fixedLeverageRatioAddress = Address.fromString("0x14e19Cb8B8bb818d341194081eCdc7c0b20bf42b")
const ONE = BigInt.fromString("1")
const ZERO = BigInt.fromString("0")
const ONE_HUNDRED = BigDecimal.fromString("100")
const FIDU_DECIMAL_PLACES = 18
const FIDU_DECIMALS = BigInt.fromI32(10).pow(FIDU_DECIMAL_PLACES as u8)
const USDC_DECIMAL_PLACES = 6
const USDC_DECIMALS = BigInt.fromI32(10).pow(USDC_DECIMAL_PLACES as u8)

export function getEstimatedSeniorPoolInvestment(
    tranchedPoolAddress: Address,
    tranchedPoolVersion: string,
    seniorPoolAddress: Address
): BigInt {
    // if (tranchedPoolVersion == VERSION_BEFORE_V2_2) {
    // This means that the pool is not compatible with multiple slices, so we need to use a hack to estimate senior pool investment
    const fixedLeverageRatioStrategyContract = FixedLeverageRatioStrategy.bind(fixedLeverageRatioAddress)
    const callResult = fixedLeverageRatioStrategyContract.try_estimateInvestment(seniorPoolAddress, tranchedPoolAddress)
    if (callResult.reverted) {
        return BigInt.fromI32(0)
    } else {
        return callResult.value
    }
    // }
    // const seniorPoolContract = SeniorPoolContract.bind(seniorPoolAddress)
    // return seniorPoolContract.estimateInvestment(tranchedPoolAddress)
}

export function getTotalDeposited(
    address: Address,
    juniorTranches: JuniorTrancheInfo[],
    seniorTranches: SeniorTrancheInfo[]
): BigInt {
    let totalDeposited = new BigInt(0)

    for (let i = 0, k = juniorTranches.length; i < k; ++i) {
        const jrTranche = juniorTranches[i]
        const srTranche = seniorTranches[i]

        if (!jrTranche || !srTranche) {
            throw new Error(`Missing tranche information for ${address.toHexString()}`)
        }

        totalDeposited = totalDeposited.plus(jrTranche.principalDeposited)
        totalDeposited = totalDeposited.plus(srTranche.principalDeposited)
    }
    return totalDeposited
}

export function getJuniorDeposited(juniorTranches: JuniorTrancheInfo[]): BigInt {
    let juniorDeposited = BigInt.zero()
    for (let i = 0; i < juniorTranches.length; i++) {
        juniorDeposited = juniorDeposited.plus(juniorTranches[i].principalDeposited)
    }
    return juniorDeposited
}

export function getSeniorDeposited(seniorTranches: SeniorTrancheInfo[]): BigInt {
    let seniorDeposited = BigInt.zero()
    for (let i = 0; i < seniorTranches.length; i++) {
        seniorDeposited = seniorDeposited.plus(seniorTranches[i].principalDeposited)
    }
    return seniorDeposited
}

export function estimateJuniorAPY(tranchedPool: TranchedPool): BigDecimal {
    if (!tranchedPool) {
        return BigDecimal.fromString("0")
    }

    const creditLine = CreditLine.load(tranchedPool.creditLine)
    if (!creditLine) {
        throw new Error(`Missing creditLine for TranchedPool ${tranchedPool.id}`)
    }

    // if (isV1StyleDeal(Address.fromString(tranchedPool.id))) {
    //     return creditLine.interestAprDecimal
    // }

    let balance: BigInt
    if (!creditLine.balance.isZero()) {
        balance = creditLine.balance
    } else if (!creditLine.limit.isZero()) {
        balance = creditLine.limit
    } else if (!creditLine.maxLimit.isZero()) {
        balance = creditLine.maxLimit
    } else {
        return BigDecimal.fromString("0")
    }

    const leverageRatio = tranchedPool.estimatedLeverageRatio
    // A missing leverage ratio implies this was a v1 style deal and the senior pool supplied all the capital
    const seniorFraction = leverageRatio ? leverageRatio.div(ONE.toBigDecimal().plus(leverageRatio)) : ONE.toBigDecimal()
    const juniorFraction = leverageRatio
        ? ONE.toBigDecimal().div(ONE.toBigDecimal().plus(leverageRatio))
        : ZERO.toBigDecimal()
    const interestRateFraction = creditLine.interestAprDecimal.div(ONE_HUNDRED)
    const juniorFeeFraction = tranchedPool.juniorFeePercent.divDecimal(ONE_HUNDRED)
    const reserveFeeFraction = tranchedPool.reserveFeePercent.divDecimal(ONE_HUNDRED)

    const grossSeniorInterest = balance.toBigDecimal().times(interestRateFraction).times(seniorFraction)
    const grossJuniorInterest = balance.toBigDecimal().times(interestRateFraction).times(juniorFraction)
    const juniorFee = grossSeniorInterest.times(juniorFeeFraction)

    const juniorReserveFeeOwed = grossJuniorInterest.times(reserveFeeFraction)
    const netJuniorInterest = grossJuniorInterest.plus(juniorFee).minus(juniorReserveFeeOwed)
    const juniorTranche = balance.toBigDecimal().times(juniorFraction)
    return netJuniorInterest.div(juniorTranche).times(ONE_HUNDRED)
}

/**
 * A helper function that creates a Transaction entity from an Ethereum event. Does not save the entity, you must call .save() yourself, after you add any additional properties.
 * @param event Ethereum event to process. Can be any event.
 * @param category The category to assign to this. Must conform to the TransactionCategory enum.
 * @param userAddress The address of the user that should be associated with this transaction. The corresponding `user` entity will be created if it doesn't exist
 * @returns Instance of a Transaction entity.
 */
export function createTransactionFromEvent(event: ethereum.Event, category: string, userAddress: Address): Transaction {
    const transaction = new Transaction(`${event.transaction.hash.toHexString()}-${event.logIndex.toString()}`)
    transaction.transactionHash = event.transaction.hash
    transaction.timestamp = event.block.timestamp.toI32()
    transaction.blockNumber = event.block.number.toI32()
    transaction.category = category
    const user = getOrInitUser(userAddress)
    transaction.user = user.id
    return transaction
}

export function usdcWithFiduPrecision(amount: BigInt): BigInt {
    return amount.times(FIDU_DECIMALS).div(USDC_DECIMALS).times(FIDU_DECIMALS)
}