import {
    DepositMade, PrincipalCollected, WithdrawalMade,
    SeniorPool as SeniorPoolContract,
    InterestCollected,
} from "../../../generated/SeniorPool/SeniorPool";
import { Fidu as FiduContract } from "../../../generated/SeniorPool/Fidu"

import { getOrInitSeniorPool, updateEstimatedSeniorPoolApy } from "./helpers";
import { getAddressFromConfig } from "../../utils";
import { CONFIG_KEYS_ADDRESSES } from "../../constants";
import { getOrInitUser } from "../../entities/user";
import { Address } from "@graphprotocol/graph-ts";

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
    //     const transaction = createTransactionFromEvent(event, "SENIOR_POOL_DEPOSIT", event.params.capitalProvider)

    //     transaction.sentAmount = event.params.amount
    //     transaction.sentToken = "USDC"
    //     transaction.receivedAmount = event.params.shares
    //     transaction.receivedToken = "FIDU"
    //     // usdc / fidu
    //     transaction.fiduPrice = usdcWithFiduPrecision(event.params.amount).div(event.params.shares)

    //     transaction.save()
    // }
}

export function handlePrincipalCollected(event: PrincipalCollected): void {
    // getOrInitBorrower(event.params.borrower, event.params.owner, event.block.timestamp)
}

export function handleWithdrawalMade(event: WithdrawalMade): void {
    // getOrInitBorrower(event.params.borrower, event.params.owner, event.block.timestamp)
}

export function handleInterestCollected(event: InterestCollected): void {
    const seniorPool = getOrInitSeniorPool()
    const seniorPoolContract = SeniorPoolContract.bind(event.address)

    seniorPool.sharePrice = seniorPoolContract.sharePrice()

    seniorPool.save()
}
