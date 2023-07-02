import {
    DepositMade, PrincipalCollected, WithdrawalMade,
    SeniorPool as SeniorPoolContract,
    InterestCollected,
    InvestmentMadeInSenior,
} from "../../../generated/SeniorPool/SeniorPool";
import { Fidu as FiduContract } from "../../../generated/SeniorPool/Fidu"

import { getOrInitSeniorPool, updateEstimatedSeniorPoolApy } from "./helpers";
import { getAddressFromConfig } from "../../utils";
import { CONFIG_KEYS_ADDRESSES, FIDU_DECIMALS, USDC_DECIMALS } from "../../constants";
import { getOrInitUser } from "../../entities/user";
import { Address, Bytes, BigInt } from "@graphprotocol/graph-ts";
import { createTransactionFromEvent, usdcWithFiduPrecision } from "../../entities/helpers";
import { getOrInitTranchedPool } from "../../entities/tranched_pool";

export function handleDepositMade(event: DepositMade): void {
    const seniorPool = getOrInitSeniorPool()
    const seniorPoolContract = SeniorPoolContract.bind(event.address)
    const fiduContract = FiduContract.bind(getAddressFromConfig(seniorPoolContract, CONFIG_KEYS_ADDRESSES.Fidu))

    seniorPool.totalShares = fiduContract.totalSupply()
    seniorPool.assets = seniorPoolContract.assets()

    updateEstimatedSeniorPoolApy(seniorPool)
    getOrInitUser(event.params.capitalProvider)

    seniorPool.save()

    // const stakingRewardsAddress = Address.fromString(STAKING_REWARDS_ADDRESS)

    // Purposefully ignore deposits from StakingRewards contract because those will get captured as DepositAndStake events instead
    // if (!event.params.capitalProvider.equals(stakingRewardsAddress)) {
    const transaction = createTransactionFromEvent(event, "SENIOR_POOL_DEPOSIT", event.params.capitalProvider)

    transaction.sentAmount = event.params.amount
    transaction.sentToken = "USDC"
    transaction.receivedAmount = event.params.shares
    transaction.receivedToken = "FIDU"
    // usdc / fidu
    transaction.fiduPrice = usdcWithFiduPrecision(event.params.amount).div(event.params.shares)

    transaction.save()
    // }
}

function handleInvestmentMadeInTranchedPool(
    seniorPoolAddress: Address,
    tranchedPoolAddress: Address,
    investedAmount: BigInt,
    timestamp: BigInt
): void {
    const seniorPool = getOrInitSeniorPool()
    const seniorPoolContract = SeniorPoolContract.bind(seniorPoolAddress)
    const tranchedPoolAddressString = tranchedPoolAddress.toHexString()

    seniorPool.totalLoansOutstanding = seniorPoolContract.totalLoansOutstanding()
    seniorPool.assets = seniorPoolContract.assets()

    if (!seniorPool.tranchedPools.includes(tranchedPoolAddressString)) {
        seniorPool.tranchedPools = seniorPool.tranchedPools.concat([tranchedPoolAddressString])
        seniorPool.totalInvested = seniorPool.totalInvested.plus(investedAmount)

        updateEstimatedSeniorPoolApy(seniorPool)
    }

    const tranchedPool = getOrInitTranchedPool(tranchedPoolAddress, timestamp, Bytes.fromHexString('0x'))
    if (tranchedPool.actualSeniorPoolInvestment === null) {
        tranchedPool.actualSeniorPoolInvestment = investedAmount
    } else {
        const currentActualSeniorPoolInvestment = tranchedPool.actualSeniorPoolInvestment as BigInt
        tranchedPool.actualSeniorPoolInvestment = currentActualSeniorPoolInvestment.plus(investedAmount)
    }

    tranchedPool.save()
    seniorPool.save()
}

export function handleInvestmentMadeInSenior(event: InvestmentMadeInSenior): void {
    handleInvestmentMadeInTranchedPool(
        event.address,
        event.params.tranchedPool,
        event.params.amount,
        event.block.timestamp
    )
}

export function handlePrincipalCollected(event: PrincipalCollected): void {
    const seniorPool = getOrInitSeniorPool()
    const seniorPoolContract = SeniorPoolContract.bind(event.address)

    seniorPool.sharePrice = seniorPoolContract.sharePrice()
    seniorPool.totalLoansOutstanding = seniorPoolContract.totalLoansOutstanding()
    seniorPool.assets = seniorPoolContract.assets() // assets are updated when totalLoansOutstanding changes

    // updateEstimatedApyFromGfiRaw(seniorPool)
    updateEstimatedSeniorPoolApy(seniorPool)

    const tranchedPool = getOrInitTranchedPool(event.params.payer, event.block.timestamp, Bytes.fromHexString('0x'))
    // if (tranchedPool.actualSeniorPoolInvestment !== null) {
    //   const currentActualSeniorPoolInvestment = tranchedPool.actualSeniorPoolInvestment as BigInt
    //   tranchedPool.actualSeniorPoolInvestment = currentActualSeniorPoolInvestment.minus(event.params.amount)
    // }

    tranchedPool.save()
    seniorPool.save()
}

export function handleWithdrawalMade(event: WithdrawalMade): void {
    const seniorPool = getOrInitSeniorPool()
    const seniorPoolContract = SeniorPoolContract.bind(event.address)
    const fiduContract = FiduContract.bind(getAddressFromConfig(seniorPoolContract, CONFIG_KEYS_ADDRESSES.Fidu))

    seniorPool.assets = seniorPoolContract.assets()
    seniorPool.totalShares = fiduContract.totalSupply()

    updateEstimatedSeniorPoolApy(seniorPool)

    seniorPool.save()

    // const stakingRewardsAddress = Address.fromString(STAKING_REWARDS_ADDRESS)

    // Purposefully ignore withdrawals made by StakingRewards contract because those will be captured as UnstakeAndWithdraw
    // if (!event.params.capitalProvider.equals(stakingRewardsAddress)) {
    {
        const transaction = createTransactionFromEvent(event, "SENIOR_POOL_WITHDRAWAL", event.params.capitalProvider)

        const seniorPoolContract = SeniorPoolContract.bind(event.address)
        const sharePrice = seniorPoolContract.sharePrice()

        // updateEstimatedApyFromGfiRaw(seniorPool)

        transaction.sentAmount = event.params.userAmount
            .plus(event.params.reserveAmount)
            .times(FIDU_DECIMALS)
            .div(USDC_DECIMALS)
            .times(FIDU_DECIMALS)
            .div(sharePrice)
        transaction.sentToken = "FIDU"
        transaction.receivedAmount = event.params.userAmount
        transaction.receivedToken = "USDC"
        transaction.fiduPrice = sharePrice

        transaction.save()

        // const withdrawalRequest = SeniorPoolWithdrawalRequest.load(event.params.capitalProvider.toHexString())
        // if (withdrawalRequest) {
        //     withdrawalRequest.usdcWithdrawable = BigInt.zero()
        //     withdrawalRequest.save()
        // }
    }
}

export function handleInterestCollected(event: InterestCollected): void {
    const seniorPool = getOrInitSeniorPool()
    const seniorPoolContract = SeniorPoolContract.bind(event.address)

    seniorPool.sharePrice = seniorPoolContract.sharePrice()

    seniorPool.save()
}
