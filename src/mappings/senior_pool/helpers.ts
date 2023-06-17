import { Address, BigDecimal, BigInt } from "@graphprotocol/graph-ts"
import { CreditLine, SeniorPool, TranchedPool } from "../../../generated/schema"
import {DobermanConfig} from "../../../generated/SeniorPool/DobermanConfig"
import { CONFIG_KEYS_NUMBERS } from "../../constants"

const SENIOR_POOL_ADDRESS = '0x9Cd22ACeC917B76968FEc7E8Ec29D983681E86CD'
const DOBERMAN_CONFIG_ADDRESS = '0x012e4f30a508fC768D16Fc352EA603CCB632a0E0'


function calculateEstimatedInterestForTranchedPool(tranchedPoolId: string): BigDecimal {
    const tranchedPool = TranchedPool.load(tranchedPoolId)
    if (!tranchedPool) {
      return BigDecimal.fromString("0")
    }
    const creditLine = CreditLine.load(tranchedPool.creditLine)
    if (!creditLine) {
      return BigDecimal.fromString("0")
    }
  
    const protocolFee = BigDecimal.fromString("0.1")
    const leverageRatio = tranchedPool.estimatedLeverageRatio
    const seniorFraction = leverageRatio
      ? leverageRatio.div(BigDecimal.fromString("1").plus(leverageRatio))
      : BigDecimal.fromString("1")
    const seniorBalance = creditLine.balance.toBigDecimal().times(seniorFraction)
    const juniorFeePercentage = tranchedPool.juniorFeePercent.toBigDecimal().div(BigDecimal.fromString("100"))
    // const isV1Pool = tranchedPool.isV1StyleDeal
    const seniorPoolPercentageOfInterest = 
    // isV1Pool
    //   ? BigDecimal.fromString("1").minus(protocolFee): 
    BigDecimal.fromString("1").minus(juniorFeePercentage).minus(protocolFee)
    return seniorBalance.times(creditLine.interestAprDecimal).times(seniorPoolPercentageOfInterest)
  }
  
class SeniorPoolApyCalcResult {
    estimatedApy: BigDecimal
    estimatedTotalInterest: BigDecimal
    constructor(estimatedApy: BigDecimal, estimatedTotalInterest: BigDecimal) {
      this.estimatedApy = estimatedApy
      this.estimatedTotalInterest = estimatedTotalInterest
    }
  }

  
export function getOrInitSeniorPool(): SeniorPool {
    let seniorPool = SeniorPool.load("1")
    if (!seniorPool) {
      seniorPool = new SeniorPool("1")
      seniorPool.address = Address.fromString(SENIOR_POOL_ADDRESS)
      seniorPool.sharePrice = BigInt.zero()
      seniorPool.totalShares = BigInt.zero()
      seniorPool.assets = BigInt.zero()
      seniorPool.totalLoansOutstanding = BigInt.zero()
      seniorPool.tranchedPools = []
  
    //   const dobermanConfigContract = DobermanConfig.bind(Address.fromString(DOBERMAN_CONFIG_ADDRESS))
    //   const getNumberCallResult = dobermanConfigContract.try_getNumber(
    //     BigInt.fromI32(CONFIG_KEYS_NUMBERS.SeniorPoolWithdrawalCancelationFeeInBps)
    //   )
    //   if (!getNumberCallResult.reverted) {
    //     seniorPool.withdrawalCancellationFee = getNumberCallResult.value.divDecimal(BigDecimal.fromString("10000"))
    //   } else {
    //     seniorPool.withdrawalCancellationFee = BigDecimal.zero()
    //   }
  
      seniorPool.estimatedTotalInterest = BigDecimal.zero()
      seniorPool.estimatedApy = BigDecimal.zero()
      seniorPool.estimatedApyFromGfiRaw = BigDecimal.zero()
      seniorPool.totalInvested = BigInt.zero()
      seniorPool.totalWrittenDown = BigInt.zero()
      seniorPool.defaultRate = BigDecimal.zero()
  
      seniorPool.save()
    }
    return seniorPool
  }

  /**
 * Just a convenience function that will compute and set seniorPool.estimatedApy and seniorPool.estimatedTotalInterest
 * YOU STILL HAVE TO CALL seniorPool.save() AFTER CALLING THIS FUNCTION
 */
export function updateEstimatedSeniorPoolApy(seniorPool: SeniorPool): void {
    const apyCalcResult = calculateSeniorPoolApy(seniorPool)
    seniorPool.estimatedApy = apyCalcResult.estimatedApy
    seniorPool.estimatedTotalInterest = apyCalcResult.estimatedTotalInterest
  }

  /**
 * Helper function that computes the senior pool APY based on the interest from tranched pools it has invested in and its current assets
 * @param seniorPool SeniorPool
 * @returns { estimatedApy: BigDecimal, estimatedTotalInterest: BigDecimal }
 */
export function calculateSeniorPoolApy(seniorPool: SeniorPool): SeniorPoolApyCalcResult {
    if (seniorPool.assets.isZero() || seniorPool.tranchedPools.length == 0) {
      return new SeniorPoolApyCalcResult(BigDecimal.zero(), BigDecimal.zero())
    }
    let estimatedTotalInterest = BigDecimal.zero()
    for (let i = 0; i < seniorPool.tranchedPools.length; i++) {
      const tranchedPoolId = seniorPool.tranchedPools[i]
      estimatedTotalInterest = estimatedTotalInterest.plus(calculateEstimatedInterestForTranchedPool(tranchedPoolId))
    }
  
    const estimatedApy = estimatedTotalInterest.div(seniorPool.assets.toBigDecimal())
    return new SeniorPoolApyCalcResult(estimatedApy, estimatedTotalInterest)
  }
  