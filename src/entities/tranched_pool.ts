import { Address, BigDecimal, BigInt, Bytes, log, store } from "@graphprotocol/graph-ts"
import { CreditLine, JuniorTrancheInfo, SeniorTrancheInfo, TranchedPool } from "../../generated/schema"

import { TranchedPool as TranchedPoolContract, DepositMade, TrancheLocked } from "../../generated/templates/TranchedPool/TranchedPool"
import { DobermanConfig as DobermanConfigContract } from "../../generated/templates/TranchedPool/DobermanConfig"
import { GFI_DECIMALS, USDC_DECIMALS, CONFIG_KEYS_ADDRESSES, CONFIG_KEYS_NUMBERS, FIDU_DECIMALS, VERSION_V2_2 } from "../constants"
import { estimateJuniorAPY, getEstimatedSeniorPoolInvestment, getJuniorDeposited, getSeniorDeposited, getTotalDeposited } from "./helpers"
import { initOrUpdateCreditLine } from "./credit_line"
import { getOrInitUser } from "./user"

const secondsPerYear_BigInt = BigInt.fromI32(60 * 60 * 24 * 365)
const secondsPerYear_BigDecimal = secondsPerYear_BigInt.toBigDecimal()

export function getOrInitTranchedPool(poolAddress: Address, timestamp: BigInt, txHash: Bytes): TranchedPool {
    let tranchedPool = TranchedPool.load(poolAddress.toHexString())
    if (!tranchedPool) {
        tranchedPool = initOrUpdateTranchedPool(poolAddress, timestamp, txHash)
    }
    return tranchedPool
}

export function initOrUpdateTranchedPool(address: Address, timestamp: BigInt, txHash: Bytes): TranchedPool {
    let tranchedPool = TranchedPool.load(address.toHexString())
    const isCreating = !tranchedPool
    if (!tranchedPool) {
        tranchedPool = new TranchedPool(address.toHexString())
    }

    const poolContract = TranchedPoolContract.bind(address)
    const dobermanConfigContract = DobermanConfigContract.bind(poolContract.config())
    const seniorPoolAddress = dobermanConfigContract.getAddress(BigInt.fromI32(CONFIG_KEYS_ADDRESSES.SeniorPool))

    // let version: string = VERSION_BEFORE_V2_2
    // let numSlices = BigInt.fromI32(1)
    // let fundableAt = 0
    // if (timestamp && isAfterV2_2(timestamp)) {
    //     const callResult = poolContract.try_numSlices()
    //     if (callResult.reverted) {
    //         log.warning("numSlices reverted for pool {}", [address.toHexString()])
    //     } else {
    //         // Assuming that a pool is a v2_2 pool if requests work
    //         numSlices = callResult.value
    //         version = VERSION_V2_2
    //     }
    //     const callFundableAt = poolContract.try_fundableAt()
    //     if (callFundableAt.reverted) {
    //         log.warning("fundableAt reverted for pool {}", [address.toHexString()])
    //     } else {
    //         fundableAt = callFundableAt.value.toI32()
    //         // Assuming that a pool is a v2_2 pool if requests work
    //         version = VERSION_V2_2
    //     }
    // }

    let version = VERSION_V2_2
    let numSlices = BigInt.fromI32(1)
    const callResult = poolContract.try_numSlices()
    if (callResult.reverted) {
        log.warning("numSlices reverted for pool {}", [address.toHexString()])
    } else {
        // Assuming that a pool is a v2_2 pool if requests work
        numSlices = callResult.value
        version = VERSION_V2_2
    }

    let counter = 1
    const juniorTranches: JuniorTrancheInfo[] = []
    const seniorTranches: SeniorTrancheInfo[] = []
    for (let i = 0; i < numSlices.toI32(); i++) {
        const seniorTrancheInfo = poolContract.getTranche(BigInt.fromI32(counter))
        const seniorId = `${address.toHexString()}-${seniorTrancheInfo.id.toString()}`
        let seniorTranche = SeniorTrancheInfo.load(seniorId)
        if (!seniorTranche) {
            seniorTranche = new SeniorTrancheInfo(seniorId)
        }
        seniorTranche.trancheId = BigInt.fromI32(counter)
        seniorTranche.lockedUntil = seniorTrancheInfo.lockedUntil
        seniorTranche.loan = address.toHexString()
        seniorTranche.tranchedPool = address.toHexString()
        seniorTranche.principalDeposited = seniorTrancheInfo.principalDeposited
        seniorTranche.principalSharePrice = seniorTrancheInfo.principalSharePrice
        seniorTranche.interestSharePrice = seniorTrancheInfo.interestSharePrice
        seniorTranche.save()
        seniorTranches.push(seniorTranche)

        counter++

        const juniorTrancheInfo = poolContract.getTranche(BigInt.fromI32(counter))

        const juniorId = `${address.toHexString()}-${juniorTrancheInfo.id.toString()}`
        let juniorTranche = JuniorTrancheInfo.load(juniorId)
        if (!juniorTranche) {
            juniorTranche = new JuniorTrancheInfo(juniorId)
        }
        juniorTranche.trancheId = BigInt.fromI32(counter)
        juniorTranche.lockedUntil = juniorTrancheInfo.lockedUntil
        juniorTranche.loan = address.toHexString()
        juniorTranche.tranchedPool = address.toHexString()
        juniorTranche.principalSharePrice = juniorTrancheInfo.principalSharePrice
        juniorTranche.interestSharePrice = juniorTrancheInfo.interestSharePrice
        juniorTranche.principalDeposited = juniorTrancheInfo.principalDeposited
        juniorTranche.save()
        juniorTranches.push(juniorTranche)

        counter++
    }

    tranchedPool.juniorFeePercent = poolContract.juniorFeePercent()
    if (dobermanConfigContract.getNumber(BigInt.fromI32(CONFIG_KEYS_NUMBERS.ReserveDenominator)) == BigInt.fromI32(0)) {
        tranchedPool.reserveFeePercent = dobermanConfigContract.getNumber(BigInt.fromI32(CONFIG_KEYS_NUMBERS.ReserveDenominator))
    } else {
        tranchedPool.reserveFeePercent = BigInt.fromI32(100).div(
            dobermanConfigContract.try_getNumber(BigInt.fromI32(CONFIG_KEYS_NUMBERS.ReserveDenominator)).value
        )
    }

    tranchedPool.estimatedSeniorPoolContribution = getEstimatedSeniorPoolInvestment(address, version, seniorPoolAddress)
    tranchedPool.totalDeposited = getTotalDeposited(address, juniorTranches, seniorTranches)
    tranchedPool.estimatedTotalAssets = tranchedPool.totalDeposited.plus(tranchedPool.estimatedSeniorPoolContribution)
    tranchedPool.juniorDeposited = getJuniorDeposited(juniorTranches)
    tranchedPool.seniorDeposited = getSeniorDeposited(seniorTranches)
    tranchedPool.isPaused = poolContract.paused()
    tranchedPool.drawdownsPaused = poolContract.drawdownsPaused()
    // tranchedPool.isV1StyleDeal = isV1StyleDeal(address)
    // tranchedPool.version = version
    // const createdAtOverride = getCreatedAtOverride(address)
    // tranchedPool.createdAt = createdAtOverride != 0 ? createdAtOverride : poolContract.createdAt().toI32()
    tranchedPool.createdAt = poolContract.createdAt().toI32()
    // tranchedPool.fundableAt = fundableAt == 0 ? tranchedPool.createdAt : fundableAt
    tranchedPool.fundableAt = poolContract.fundableAt().toI32()
    tranchedPool.principalAmount = BigInt.zero()

    const creditLineAddress = poolContract.creditLine()
    const creditLine = initOrUpdateCreditLine(creditLineAddress, timestamp)
    tranchedPool.creditLine = creditLine.id
    tranchedPool.creditLineAddress = creditLineAddress
    tranchedPool.fundingLimit = creditLine.maxLimit
    tranchedPool.principalAmount = creditLine.limit
    tranchedPool.balance = creditLine.balance
    tranchedPool.nextDueTime = creditLine.nextDueTime
    tranchedPool.termEndTime = creditLine.termEndTime
    tranchedPool.termStartTime = creditLine.termStartTime
    tranchedPool.interestRate = creditLine.interestAprDecimal
    tranchedPool.interestRateBigInt = creditLine.interestApr
    tranchedPool.lateFeeRate = creditLine.lateFeeApr
    tranchedPool.interestAccruedAsOf = creditLine.interestAccruedAsOf
    tranchedPool.borrowerContract = creditLine.borrowerContract
    const limit = !creditLine.limit.isZero() ? creditLine.limit : creditLine.maxLimit
    tranchedPool.remainingCapacity = limit.minus(tranchedPool.estimatedTotalAssets)
    // This can happen in weird cases where the senior pool investment causes a pool to overfill
    if (tranchedPool.remainingCapacity.lt(BigInt.zero())) {
        tranchedPool.remainingCapacity = BigInt.zero()
    }
    if (isCreating) {
        tranchedPool.backers = []
        tranchedPool.tokens = []
        tranchedPool.numBackers = 0
        tranchedPool.principalAmountRepaid = BigInt.zero()
        tranchedPool.interestAmountRepaid = BigInt.zero()
        tranchedPool.actualSeniorPoolInvestment = null
        // V1 style deals do not have a leverage ratio because all capital came from the senior pool
        // if (tranchedPool.isV1StyleDeal) {
        //     tranchedPool.estimatedLeverageRatio = null
        // } else {
        tranchedPool.estimatedLeverageRatio = getLeverageRatioFromConfig(dobermanConfigContract)
        // }
    }

    // const getAllowedUIDTypes_callResult = poolContract.try_allowedUIDTypes()
    // if (!getAllowedUIDTypes_callResult.reverted) {
    //     const allowedUidInts = getAllowedUIDTypes_callResult.value
    //     const allowedUidStrings: string[] = []
    //     for (let i = 0; i < allowedUidInts.length; i++) {
    //         const uidType = allowedUidInts[i]
    //         if (uidType.equals(BigInt.fromI32(0))) {
    //             allowedUidStrings.push("NON_US_INDIVIDUAL")
    //         } else if (uidType.equals(BigInt.fromI32(1))) {
    //             allowedUidStrings.push("US_ACCREDITED_INDIVIDUAL")
    //         } else if (uidType.equals(BigInt.fromI32(2))) {
    //             allowedUidStrings.push("US_NON_ACCREDITED_INDIVIDUAL")
    //         } else if (uidType.equals(BigInt.fromI32(3))) {
    //             allowedUidStrings.push("US_ENTITY")
    //         } else if (uidType.equals(BigInt.fromI32(4))) {
    //             allowedUidStrings.push("NON_US_ENTITY")
    //         }
    //     }
    //     tranchedPool.allowedUidTypes = allowedUidStrings
    // } else {
    //     // by default, assume everything except US non-accredited individual is allowed
    //     tranchedPool.allowedUidTypes = ["NON_US_INDIVIDUAL", "US_ACCREDITED_INDIVIDUAL", "US_ENTITY", "NON_US_ENTITY"]
    // }

    tranchedPool.address = address
    // if (isCreating) {
    //     const schedulingResult = generateRepaymentScheduleForTranchedPool(tranchedPool)
    //     tranchedPool.repaymentSchedule = schedulingResult.repaymentIds
    //     tranchedPool.numRepayments = schedulingResult.repaymentIds.length
    //     tranchedPool.termInSeconds = schedulingResult.termInSeconds
    //     tranchedPool.repaymentFrequency = schedulingResult.repaymentFrequency
    // }
    if (isCreating) {
        tranchedPool.termInSeconds = tranchedPool.termEndTime.toI32() - tranchedPool.termStartTime.toI32()
        tranchedPool.numRepayments = 0
    }
    tranchedPool.initialInterestOwed = calculateInitialInterestOwed(
        tranchedPool.principalAmount,
        tranchedPool.interestRate,
        tranchedPool.termInSeconds
    )
    tranchedPool.usdcApy = estimateJuniorAPY(tranchedPool)
    if (isCreating) {
        tranchedPool.rawGfiApy = BigDecimal.zero()
    }
    tranchedPool.txHash = txHash
    tranchedPool.save()

    // if (isCreating) {
    //     calculateApyFromGfiForAllPools()
    // }

    return tranchedPool
}

function calculateInitialInterestOwed(
    tp_principal: BigInt,
    tp_interestRate: BigDecimal,
    tp_termInSeconds: i32
): BigInt {
    const principal = tp_principal.toBigDecimal()
    const interestRatePerSecond = tp_interestRate.div(secondsPerYear_BigDecimal)
    const termInSeconds = BigInt.fromI32(tp_termInSeconds).toBigDecimal()
    const interestOwed = principal.times(interestRatePerSecond.times(termInSeconds))
    return BigInt.fromString(interestOwed.toString())
}

export function getLeverageRatioFromConfig(goldfinchConfigContract: DobermanConfigContract): BigDecimal {
    return goldfinchConfigContract
        .getNumber(BigInt.fromI32(CONFIG_KEYS_NUMBERS.LeverageRatio))
        .toBigDecimal()
        .div(FIDU_DECIMALS.toBigDecimal())
}

export function handleLockTranche(event: TrancheLocked): void {
    const tranchedPool = getOrInitTranchedPool(event.address, event.block.timestamp, Bytes.fromHexString('0x'))
    if ((event.params.trancheId.toI32() % 2) == 0) {
        tranchedPool.juniorLocked = true
        tranchedPool.save()
    } else {
        tranchedPool.seniorLocked = true
        tranchedPool.save()
    }
}

export function handleDeposit(event: DepositMade): void {
    // const backer = getOrInitUser(event.params.owner)

    const tranchedPool = getOrInitTranchedPool(event.address, event.block.timestamp, Bytes.fromHexString('0x'))
    if (event.params.tranche.toI32() % 2 == 0) {
        const juniorTrancheInfo = JuniorTrancheInfo.load(`${event.address.toHexString()}-${event.params.tranche.toString()}`)
        if (juniorTrancheInfo) {
            juniorTrancheInfo.principalDeposited = juniorTrancheInfo.principalDeposited.plus(event.params.amount)
            juniorTrancheInfo.save()
        }

        // if (!tranchedPool.backers.includes(backer.id)) {
        //     const addresses = tranchedPool.backers
        //     addresses.push(backer.id)
        //     tranchedPool.backers = addresses
        //     tranchedPool.numBackers = addresses.length
        // }

        tranchedPool.juniorDeposited = tranchedPool.juniorDeposited.plus(event.params.amount)
    } else {
        const seniorTrancheInfo = SeniorTrancheInfo.load(`${event.address.toHexString()}-${event.params.tranche.toString()}`)
        if (seniorTrancheInfo) {
            seniorTrancheInfo.principalDeposited = seniorTrancheInfo.principalDeposited.plus(event.params.amount)
            seniorTrancheInfo.save()
        }

        // if (!tranchedPool.backers.includes(backer.id)) {
        //     const addresses = tranchedPool.backers
        //     addresses.push(backer.id)
        //     tranchedPool.backers = addresses
        //     tranchedPool.numBackers = addresses.length
        // }

        tranchedPool.seniorDeposited = tranchedPool.seniorDeposited.plus(event.params.amount)

    }
    tranchedPool.estimatedTotalAssets = tranchedPool.estimatedTotalAssets.plus(event.params.amount)

    const creditLine = CreditLine.load(tranchedPool.creditLine)
    if (!creditLine) {
        throw new Error(`Missing credit line for tranched pool ${tranchedPool.id} while handling deposit`)
    }
    const limit = !creditLine.limit.isZero() ? creditLine.limit : creditLine.maxLimit
    tranchedPool.remainingCapacity = limit.minus(tranchedPool.estimatedTotalAssets)
    tranchedPool.save()

    updatePoolCreditLine(event.address, event.block.timestamp)
}

export function updatePoolCreditLine(address: Address, timestamp: BigInt): void {
    const contract = TranchedPoolContract.bind(address)
    const creditLineAddress = contract.creditLine()
    const creditLine = initOrUpdateCreditLine(creditLineAddress, timestamp)
    const tranchedPool = getOrInitTranchedPool(address, timestamp, Bytes.fromHexString('0x'))
    tranchedPool.creditLine = creditLine.id
    tranchedPool.creditLineAddress = creditLineAddress
    tranchedPool.save()
}
